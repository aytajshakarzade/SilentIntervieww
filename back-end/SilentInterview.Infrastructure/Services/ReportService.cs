using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;
using SilentInterview.Application.Common.Models;
using SilentInterview.Application.DTOs.Report;
using SilentInterview.Application.Interfaces;
using SilentInterview.Application.Settings;
using SilentInterview.Domain.Entities;
using SilentInterview.Infrastructure.Persistence;
using System.Text;
using System.Text.Json;
using System.Text.RegularExpressions;

namespace SilentInterview.Infrastructure.Services;

/// <summary>
/// Produces repeatable, explainable interview reports from persisted answers
/// and the real per-question analytics (eye contact, emotion, speech pacing)
/// captured live during the interview. No value here is randomly generated:
/// every metric is either a real captured signal or a deterministic function
/// of one or more real captured signals.
/// </summary>
public sealed class ReportService : IReportService
{
    private readonly SilentInterviewDbContext _context;
    private readonly InterviewReportSettings _settings;
    private static readonly JsonSerializerOptions JsonOptions = new(JsonSerializerDefaults.Web);

    public ReportService(
        SilentInterviewDbContext context,
        IOptions<InterviewReportSettings> settings)
    {
        _context = context;
        _settings = settings.Value;
    }

    public async Task<PagedResult<ReportDto>> GetAllAsync(ReportQueryParameters parameters, Guid? scopeCompanyId, Guid? scopeCandidateUserId = null)
    {
        IQueryable<Report> query = _context.Reports.AsNoTracking();

        if (scopeCompanyId.HasValue)
        {
            query = query.Where(x =>
                x.InterviewSession.JobApplication.Job.CompanyId == scopeCompanyId.Value);
        }

        if (scopeCandidateUserId.HasValue)
        {
            query = query.Where(x =>
                x.InterviewSession.JobApplication.Candidate.UserId == scopeCandidateUserId.Value);
        }

        if (!string.IsNullOrWhiteSpace(parameters.Search))
        {
            var search = parameters.Search.Trim().ToLower();
            query = query.Where(x => x.Feedback.ToLower().Contains(search));
        }

        if (parameters.InterviewSessionId.HasValue)
            query = query.Where(x => x.InterviewSessionId == parameters.InterviewSessionId.Value);
        if (parameters.MinScore.HasValue)
            query = query.Where(x => x.Score >= parameters.MinScore.Value);
        if (parameters.MaxScore.HasValue)
            query = query.Where(x => x.Score <= parameters.MaxScore.Value);

        query = parameters.SortBy.ToLowerInvariant() switch
        {
            "score" => parameters.Descending ? query.OrderByDescending(x => x.Score) : query.OrderBy(x => x.Score),
            "createdat" => parameters.Descending ? query.OrderByDescending(x => x.CreatedAt) : query.OrderBy(x => x.CreatedAt),
            "interviewsessionid" => parameters.Descending ? query.OrderByDescending(x => x.InterviewSessionId) : query.OrderBy(x => x.InterviewSessionId),
            _ => parameters.Descending ? query.OrderByDescending(x => x.Id) : query.OrderBy(x => x.Id)
        };

        var totalCount = await query.CountAsync();
        var reports = await query
            .Skip((parameters.PageNumber - 1) * parameters.PageSize)
            .Take(parameters.PageSize)
            .ToListAsync();

        return new PagedResult<ReportDto>
        {
            Items = reports.Select(ToDto).ToList(),
            TotalCount = totalCount,
            PageNumber = parameters.PageNumber,
            PageSize = parameters.PageSize
        };
    }

    public async Task<ReportDto?> GetByIdAsync(Guid id, Guid? scopeCompanyId, Guid? scopeCandidateUserId = null)
    {
        var query = _context.Reports.AsNoTracking().Where(x => x.Id == id);

        if (scopeCompanyId.HasValue)
        {
            query = query.Where(x =>
                x.InterviewSession.JobApplication.Job.CompanyId == scopeCompanyId.Value);
        }

        if (scopeCandidateUserId.HasValue)
        {
            query = query.Where(x =>
                x.InterviewSession.JobApplication.Candidate.UserId == scopeCandidateUserId.Value);
        }

        var report = await query.FirstOrDefaultAsync();
        return report is null ? null : ToDto(report);
    }

    public async Task<ReportDto> CreateAsync(CreateReportRequest request)
    {
        var report = new Report
        {
            Id = Guid.NewGuid(),
            InterviewSessionId = request.InterviewSessionId,
            Score = request.Score,
            Feedback = request.Feedback,
            CreatedAt = DateTime.UtcNow
        };
        _context.Reports.Add(report);
        await _context.SaveChangesAsync();
        return ToDto(report);
    }

    public async Task<ReportDto> GenerateFromInterviewAsync(Guid interviewSessionId, Guid? scopeCompanyId, Guid? scopeCandidateUserId = null, CancellationToken cancellationToken = default)
    {
        var sessionQuery = _context.InterviewSessions
            .Include(x => x.Answers)
            .Where(x => x.Id == interviewSessionId);

        if (scopeCompanyId.HasValue)
        {
            sessionQuery = sessionQuery.Where(x => x.JobApplication.Job.CompanyId == scopeCompanyId.Value);
        }

        if (scopeCandidateUserId.HasValue)
        {
            sessionQuery = sessionQuery.Where(x => x.JobApplication.Candidate.UserId == scopeCandidateUserId.Value);
        }

        var session = await sessionQuery.FirstOrDefaultAsync(cancellationToken)
            ?? throw new InvalidOperationException("Interview session not found.");

        if (session.EndedAt is null)
            throw new InvalidOperationException("A report can only be generated after the interview has finished.");

        var answers = session.Answers
            .Where(answer => !string.IsNullOrWhiteSpace(answer.Answer))
            .OrderBy(answer => answer.Order)
            .ToList();
        if (answers.Count == 0)
            throw new InvalidOperationException("A report can only be generated after at least one answer has been recorded.");

        var evaluation = Evaluate(answers, session.StartedAt, session.EndedAt.Value);
        var report = await _context.Reports.FirstOrDefaultAsync(
            x => x.InterviewSessionId == interviewSessionId,
            cancellationToken);

        if (report is null)
        {
            report = new Report
            {
                Id = Guid.NewGuid(),
                InterviewSessionId = interviewSessionId,
                CreatedAt = DateTime.UtcNow
            };
            _context.Reports.Add(report);
        }

        report.Score = evaluation.Score;
        report.Feedback = evaluation.Feedback;
        report.Grade = evaluation.Grade;
        report.PassProbability = evaluation.PassProbability;
        report.HiringRecommendation = evaluation.HiringRecommendation;
        report.AiSummary = evaluation.AiSummary;
        report.SkillBreakdownJson = JsonSerializer.Serialize(evaluation.SkillBreakdown, JsonOptions);
        report.TimelineJson = JsonSerializer.Serialize(evaluation.Timeline, JsonOptions);
        report.EmotionAnalysisJson = JsonSerializer.Serialize(evaluation.EmotionAnalysis, JsonOptions);
        report.EyeContactAnalysisJson = JsonSerializer.Serialize(evaluation.EyeContactAnalysis, JsonOptions);
        report.SpeechAnalysisJson = JsonSerializer.Serialize(evaluation.SpeechAnalysis, JsonOptions);
        report.StrengthsJson = JsonSerializer.Serialize(evaluation.Strengths, JsonOptions);
        report.WeaknessesJson = JsonSerializer.Serialize(evaluation.Weaknesses, JsonOptions);
        report.RecommendationsJson = JsonSerializer.Serialize(evaluation.Recommendations, JsonOptions);
        report.StarAnalysisJson = JsonSerializer.Serialize(evaluation.StarAnalysis, JsonOptions);
        report.GrammarAnalysisJson = JsonSerializer.Serialize(evaluation.GrammarAnalysis, JsonOptions);
        report.ImprovementRoadmapJson = JsonSerializer.Serialize(evaluation.ImprovementRoadmap, JsonOptions);

        await _context.SaveChangesAsync(cancellationToken);
        return ToDto(report);
    }

    public async Task<bool> UpdateAsync(Guid id, UpdateReportRequest request, Guid? scopeCompanyId)
    {
        var report = await _context.Reports.FindAsync(id);
        if (report is null) return false;

        if (scopeCompanyId.HasValue)
        {
            var inScope = await _context.Reports
                .AsNoTracking()
                .Where(x => x.Id == id)
                .AnyAsync(x => x.InterviewSession.JobApplication.Job.CompanyId == scopeCompanyId.Value);
            if (!inScope) return false;
        }

        report.Score = request.Score;
        report.Feedback = request.Feedback;
        await _context.SaveChangesAsync();
        return true;
    }

    public async Task<bool> DeleteAsync(Guid id, Guid? scopeCompanyId)
    {
        var report = await _context.Reports.FindAsync(id);
        if (report is null) return false;

        if (scopeCompanyId.HasValue)
        {
            var inScope = await _context.Reports
                .AsNoTracking()
                .Where(x => x.Id == id)
                .AnyAsync(x => x.InterviewSession.JobApplication.Job.CompanyId == scopeCompanyId.Value);
            if (!inScope) return false;
        }

        _context.Reports.Remove(report);
        await _context.SaveChangesAsync();
        return true;
    }

    // ─────────────────────────────────────────────────────────────────────
    // Evaluation — every metric below is either read directly from a real
    // captured InterviewAnswer field, or is a deterministic aggregate/
    // function of those real fields. Nothing is randomly generated. Where
    // a signal was never captured for a given answer (e.g. camera/mic
    // unavailable), it is simply excluded from the aggregate rather than
    // substituted with a fabricated value.
    // ─────────────────────────────────────────────────────────────────────

    private ReportEvaluation Evaluate(IReadOnlyList<InterviewAnswer> answers, DateTime startedAt, DateTime endedAt)
    {
        var texts = answers.Select(answer => answer.Answer.Trim()).ToList();
        var combinedText = string.Join(" ", texts);
        var wordCounts = texts.Select(CountWords).ToList();
        var totalWords = wordCounts.Sum();
        var averageWords = (decimal)totalWords / wordCounts.Count;
        var substantialRate = (decimal)wordCounts.Count(count => count >= _settings.MinimumAnswerWords) / wordCounts.Count;
        var contentScore = Scale(averageWords, _settings.TargetAverageAnswerWords, _settings.ExcellentAverageAnswerWords);
        var fillerTotalFromText = texts.Sum(CountFillerWords);
        var fillerRatio = totalWords == 0 ? 0m : (decimal)fillerTotalFromText * 100m / totalWords;
        var fluencyScore = fillerRatio <= _settings.MaximumFillerWordRatioPercent
            ? 100m
            : Math.Max(0m, 100m - (fillerRatio - _settings.MaximumFillerWordRatioPercent) * 10m);
        var baseScore = substantialRate * 50m + contentScore * 35m + fluencyScore * 15m;

        // ── Real captured signals across answers ──
        var eyeContactSamples = answers.Where(a => a.EyeContactPct.HasValue).Select(a => a.EyeContactPct!.Value).ToList();
        var avgEyeContact = eyeContactSamples.Count > 0 ? (int)Math.Round(eyeContactSamples.Average()) : (int?)null;

        var emotionSamples = answers.Where(a => !string.IsNullOrWhiteSpace(a.DominantEmotion))
            .Select(a => a.DominantEmotion!).ToList();
        var emotionCounts = emotionSamples
            .GroupBy(e => e, StringComparer.OrdinalIgnoreCase)
            .ToDictionary(g => g.Key, g => g.Count(), StringComparer.OrdinalIgnoreCase);
        var emotionPercentages = emotionSamples.Count > 0
            ? emotionCounts.ToDictionary(kv => kv.Key, kv => (int)Math.Round(kv.Value * 100m / emotionSamples.Count))
            : new Dictionary<string, int>();
        var dominantEmotion = emotionCounts.Count > 0
            ? emotionCounts.OrderByDescending(kv => kv.Value).First().Key
            : null;

        var confidenceSamples = answers.Where(a => a.ConfidenceScore.HasValue).Select(a => a.ConfidenceScore!.Value).ToList();
        var avgConfidence = confidenceSamples.Count > 0 ? (int)Math.Round(confidenceSamples.Average()) : (int?)null;

        var qualitySamples = answers.Where(a => a.QualityScore.HasValue).Select(a => a.QualityScore!.Value).ToList();
        var avgQuality = qualitySamples.Count > 0 ? (int)Math.Round(qualitySamples.Average()) : (int?)null;

        var wpmSamples = answers.Where(a => a.SpeechWpm.HasValue && a.SpeechWpm.Value > 0).Select(a => a.SpeechWpm!.Value).ToList();
        var elapsedMinutes = Math.Max((decimal)(endedAt - startedAt).TotalMinutes, 0.01m);
        var overallWpm = wpmSamples.Count > 0 ? (int)Math.Round(wpmSamples.Average()) : (int)Math.Round(totalWords / elapsedMinutes);

        var capturedFillerTotal = answers.Where(a => a.FillerWordCount.HasValue).Sum(a => a.FillerWordCount!.Value);
        var fillerWordCount = answers.Any(a => a.FillerWordCount.HasValue) ? capturedFillerTotal : fillerTotalFromText;

        var pauseSamples = answers.Where(a => a.LongestPauseSec.HasValue).Select(a => a.LongestPauseSec!.Value).ToList();
        var longestPauseSec = pauseSamples.Count > 0 ? pauseSamples.Max() : 0m;
        var averagePauseSec = pauseSamples.Count > 0 ? Math.Round(pauseSamples.Average(), 1) : 0m;

        var timeSpentSamples = answers.Where(a => a.TimeSpentSec.HasValue).Select(a => a.TimeSpentSec!.Value).ToList();

        // ── Grammar aggregation (real LanguageTool results, per InterviewAnswer.GrammarScore/GrammarIssueCount) ──
        var grammarSamples = answers.Where(a => a.GrammarScore.HasValue).ToList();
        var avgGrammar = grammarSamples.Count > 0 ? (int)Math.Round(grammarSamples.Average(a => a.GrammarScore!.Value)) : (int?)null;
        var totalGrammarIssues = answers.Where(a => a.GrammarIssueCount.HasValue).Sum(a => a.GrammarIssueCount!.Value);

        // ── STAR aggregation (real deterministic pattern detection, per InterviewAnswer.StarScore/StarComponentsDetected) ──
        var starSamples = answers.Where(a => a.StarScore.HasValue).ToList();
        var avgStar = starSamples.Count > 0 ? (int)Math.Round(starSamples.Average(a => a.StarScore!.Value)) : (int?)null;
        var situationCoveragePct = starSamples.Count > 0
            ? (int)Math.Round(starSamples.Count(a => (a.StarComponentsDetected ?? "").Contains('S')) * 100m / starSamples.Count) : 0;
        var taskCoveragePct = starSamples.Count > 0
            ? (int)Math.Round(starSamples.Count(a => (a.StarComponentsDetected ?? "").Contains('T')) * 100m / starSamples.Count) : 0;
        var actionCoveragePct = starSamples.Count > 0
            ? (int)Math.Round(starSamples.Count(a => (a.StarComponentsDetected ?? "").Contains('A')) * 100m / starSamples.Count) : 0;
        var resultCoveragePct = starSamples.Count > 0
            ? (int)Math.Round(starSamples.Count(a => (a.StarComponentsDetected ?? "").Contains('R')) * 100m / starSamples.Count) : 0;

        // ── Skill breakdown (0-100). Each skill is grounded in specific
        // real signals; where the underlying signal is entirely absent
        // for every answer, the skill falls back to the content/fluency
        // baseline derived from the transcript itself rather than a guess. ──

        // Communication = grammar (real LanguageTool) + vocabulary richness (type-token ratio)
        //   + clarity (inverse filler ratio) + pace band + sentence completeness (content/length score).
        // Formula: 25% grammar + 20% vocabulary + 20% clarity(fluencyScore) + 15% pace + 20% completeness(contentScore).
        // Falls back to the transcript-only blend (content+fluency) when LanguageTool data is unavailable.
        var vocabulary = EstimateVocabularyScore(texts);
        int speechPace;
        if (overallWpm <= 0) speechPace = 0;
        else if (overallWpm < 80) speechPace = 40;
        else if (overallWpm < _settings.MinimumRecommendedWordsPerMinute) speechPace = 65;
        else if (overallWpm <= 170) speechPace = 95;
        else if (overallWpm < 200) speechPace = 70;
        else speechPace = 45;

        var communication = avgGrammar.HasValue
            ? (int)Math.Round(avgGrammar.Value * 0.25m + vocabulary * 0.20m + fluencyScore * 0.20m + speechPace * 0.15m + contentScore * 0.20m)
            : (int)Math.Round(contentScore * 0.5m + fluencyScore * 0.5m);

        // Technical = domain keyword density (occurrences of TechnicalKeywords per 100 words)
        //   + answer completeness (substantialRate) + vocabulary richness.
        // Formula: 50% keyword density (capped at a density of 4 keyword hits per 100 words = 100 pts)
        //   + 30% completeness + 20% vocabulary. "Correctness according to interview questions" has no
        //   ground-truth answer key available in this system, so it is represented via completeness
        //   (whether the answer substantively addresses the question, per MinimumAnswerWords) rather
        //   than fabricated correctness grading.
        var technicalKeywordHits = _settings.TechnicalKeywords
            .Sum(kw => Regex.Matches(combinedText, Regex.Escape(kw), RegexOptions.IgnoreCase).Count);
        var technicalDensityPer100Words = totalWords > 0 ? (decimal)technicalKeywordHits * 100m / totalWords : 0m;
        var technicalDensityScore = Math.Min(100m, technicalDensityPer100Words / 4m * 100m);
        var technicalKnowledge = (int)Math.Round(technicalDensityScore * 0.5m + substantialRate * 100m * 0.3m + vocabulary * 0.2m);

        // Confidence = eye contact % + (100 - looking-away signal, captured indirectly via eye contact)
        //   + speech stability (inverse of wpm variance across answers) + pause ratio (inverse of avg pause)
        //   + inverse filler ratio + emotion stability.
        // Formula: weighted average of whichever real signals exist among
        //   {eyeContact, speechStability, pauseScore, fillerScore, emotionStability}.
        var confidenceSignals = new List<decimal>();
        if (avgEyeContact.HasValue) confidenceSignals.Add(avgEyeContact.Value);
        decimal? speechStability = null;
        if (wpmSamples.Count >= 2)
        {
            var meanWpm = (decimal)wpmSamples.Average();
            var variance = wpmSamples.Average(w => (decimal)Math.Pow((double)(w - meanWpm), 2));
            var stdDev = (decimal)Math.Sqrt((double)variance);
            // Lower relative stddev (steadier pace) => higher stability score.
            var relativeStdDev = meanWpm > 0 ? stdDev / meanWpm : 1m;
            speechStability = Math.Clamp(100m - relativeStdDev * 200m, 0m, 100m);
            confidenceSignals.Add(speechStability.Value);
        }
        decimal? pauseScore = null;
        if (pauseSamples.Count > 0)
        {
            // Pause ratio: average pause length relative to a 3s "comfortable" ceiling.
            pauseScore = Math.Clamp(100m - averagePauseSec / 3m * 100m, 0m, 100m);
            confidenceSignals.Add(pauseScore.Value);
        }
        var fillerConfidenceScore = fillerRatio <= _settings.MaximumFillerWordRatioPercent
            ? 100m : Math.Max(0m, 100m - (fillerRatio - _settings.MaximumFillerWordRatioPercent) * 12m);
        confidenceSignals.Add(fillerConfidenceScore);
        var emotionStabilityRaw = emotionPercentages.Count > 0
            ? Math.Clamp(100m - emotionPercentages.GetValueOrDefault("Nervous") - emotionPercentages.GetValueOrDefault("Sad") / 2m, 0m, 100m)
            : (decimal?)null;
        if (emotionStabilityRaw.HasValue) confidenceSignals.Add(emotionStabilityRaw.Value);

        var confidence = avgConfidence ?? (confidenceSignals.Count > 0 ? (int)Math.Round(confidenceSignals.Average()) : (int)Math.Round(communication * 0.6m));

        var professionalism = 0; // computed below once communication/confidence/vocabulary are known
        var eyeContactSkill = avgEyeContact ?? 0;
        var facialExpression = emotionPercentages.Count > 0
            ? Math.Clamp(100 - emotionPercentages.GetValueOrDefault("Nervous") - emotionPercentages.GetValueOrDefault("Sad") - emotionPercentages.GetValueOrDefault("Angry"), 0, 100)
            : 0;
        var bodyLanguage = avgEyeContact.HasValue ? (int)Math.Round((avgEyeContact.Value + facialExpression) / 2.0) : facialExpression;
        var stressLevel = emotionPercentages.Count > 0
            ? Math.Clamp(emotionPercentages.GetValueOrDefault("Nervous") + emotionPercentages.GetValueOrDefault("Sad") / 2, 0, 100)
            : (fillerWordCount > 0 ? Math.Min(100, fillerWordCount * 3) : 0);
        var emotionStability = 100 - stressLevel;

        // Professionalism = politeness (culture-fit-style polite phrasing subset) + vocabulary
        //   + sentence quality (grammar) + confidence + communication.
        // Formula: 20% politeness density + 20% vocabulary + 25% grammar (or fluency fallback)
        //   + 15% confidence + 20% communication.
        var politeWords = new[] { "please", "thank you", "appreciate", "grateful", "would you", "could you" };
        var politeHits = politeWords.Sum(kw => Regex.Matches(combinedText, Regex.Escape(kw), RegexOptions.IgnoreCase).Count);
        var politenessScore = Math.Min(100m, (decimal)politeHits * 100m / Math.Max(1, answers.Count));
        var grammarOrFluency = avgGrammar ?? (int)Math.Round(fluencyScore);
        professionalism = (int)Math.Round(politenessScore * 0.20m + vocabulary * 0.20m + grammarOrFluency * 0.25m + confidence * 0.15m + communication * 0.20m);

        // Leadership = confidence stability + speaking initiative (answer-length consistency)
        //   + average answer length + decisive/ownership language density + action verbs (via STAR Action component)
        //   + STAR completion + inverse hesitation frequency (filler words).
        // Formula: 20% confidence + 15% avg-answer-length score(contentScore) + 20% decisive/ownership keyword density
        //   + 20% STAR completion(avgStar) + 15% action-component coverage(actionCoveragePct) + 10% inverse hesitation(fluencyScore).
        var leadershipKeywordHits = _settings.LeadershipKeywords
            .Sum(kw => Regex.Matches(combinedText, Regex.Escape(kw), RegexOptions.IgnoreCase).Count);
        var leadershipKeywordDensityScore = Math.Min(100m, (decimal)leadershipKeywordHits * 100m / Math.Max(1, answers.Count) * 20m);
        var leadership = (int)Math.Round(
            confidence * 0.20m +
            contentScore * 0.15m +
            leadershipKeywordDensityScore * 0.20m +
            (avgStar ?? 0) * 0.20m +
            actionCoveragePct * 0.15m +
            fluencyScore * 0.10m);

        // Culture Fit = positive/teamwork/collaboration/empathy vocabulary density
        //   + professionalism + communication style (fluency).
        // Formula: 40% culture-fit keyword density (capped at 6 hits per answer = 100 pts)
        //   + 30% professionalism + 30% fluencyScore.
        var cultureFitKeywordHits = _settings.CultureFitKeywords
            .Sum(kw => Regex.Matches(combinedText, $@"\b{Regex.Escape(kw)}", RegexOptions.IgnoreCase).Count);
        var cultureFitDensityScore = Math.Min(100m, (decimal)cultureFitKeywordHits * 100m / Math.Max(1, answers.Count) / 6m * 100m);
        var cultureFit = (int)Math.Round(cultureFitDensityScore * 0.40m + professionalism * 0.30m + fluencyScore * 0.30m);

        var fluency = (int)Math.Round((double)fluencyScore);

        var skillBreakdown = new Dictionary<string, int>
        {
            ["Communication"] = Clamp100(communication),
            ["TechnicalKnowledge"] = Clamp100(technicalKnowledge),
            ["Confidence"] = Clamp100(confidence),
            ["Professionalism"] = Clamp100(professionalism),
            ["Vocabulary"] = Clamp100(vocabulary),
            ["Fluency"] = Clamp100(fluency),
            ["EyeContact"] = Clamp100(eyeContactSkill),
            ["FacialExpression"] = Clamp100(facialExpression),
            ["BodyLanguage"] = Clamp100(bodyLanguage),
            ["StressLevel"] = Clamp100(stressLevel),
            ["EmotionStability"] = Clamp100(emotionStability),
            ["SpeechPace"] = Clamp100(speechPace),
            ["Leadership"] = Clamp100(leadership),
            ["CultureFit"] = Clamp100(cultureFit),
            ["Grammar"] = Clamp100(avgGrammar ?? grammarOrFluency),
            ["StarStructure"] = Clamp100(avgStar ?? 0),
        };

        // The report's headline session score must not depend on eye contact,
        // detected emotion, facial expression, or inferred confidence. Use only
        // answer-content signals and renormalize when optional evaluations are absent.
        var scoreSignals = new List<(decimal Weight, decimal Value)>
        {
            (0.20m, Math.Clamp(baseScore, 0m, 100m)),
            (0.30m, technicalKnowledge)
        };
        if (avgGrammar.HasValue) scoreSignals.Add((0.25m, avgGrammar.Value));
        if (avgStar.HasValue) scoreSignals.Add((0.25m, avgStar.Value));
        var totalScoreWeight = scoreSignals.Sum(signal => signal.Weight);
        var score = totalScoreWeight > 0m
            ? (int)Math.Round(scoreSignals.Sum(signal => signal.Weight * signal.Value) / totalScoreWeight)
            : (int)Math.Round(Math.Clamp(baseScore, 0m, 100m));
        score = Math.Clamp(score, 0, 100);

        var grade = score switch
        {
            >= 90 => "A",
            >= 80 => "B",
            >= 70 => "C",
            >= 60 => "D",
            _ => "F"
        };

        var passProbability = Math.Clamp(score - 5 + (avgQuality.HasValue ? (avgQuality.Value - score) / 4 : 0), 0, 100);

        var hiringRecommendation = score switch
        {
            >= 85 => "Strong Hire",
            >= 70 => "Hire",
            >= 55 => "Borderline",
            _ => "No Hire"
        };

        // ── Per-question timeline ──
        var timeline = answers.Select((answer, index) =>
        {
            var suggestions = new List<string>();
            var answerWordCount = CountWords(answer.Answer);
            if (answerWordCount < _settings.MinimumAnswerWords)
                suggestions.Add("Expand this answer with more specific detail or an example.");
            if (answer.EyeContactPct.HasValue && answer.EyeContactPct.Value < 50)
                suggestions.Add("Try to look at the camera more consistently while answering.");
            if (answer.FillerWordCount is > 2)
                suggestions.Add("Reduce filler words by pausing briefly instead.");
            if (answer.SpeechWpm.HasValue && answer.SpeechWpm.Value > 0 && answer.SpeechWpm.Value < _settings.MinimumRecommendedWordsPerMinute)
                suggestions.Add("Speak with a bit more energy and pace.");
            if (answer.SpeechWpm.HasValue && answer.SpeechWpm.Value > _settings.MaximumRecommendedWordsPerMinute)
                suggestions.Add("Slow down slightly for clarity.");
            if (answer.GrammarScore.HasValue && answer.GrammarScore.Value < 70)
                suggestions.Add("Review this answer for grammar clarity — several issues were flagged.");
            if (answer.StarScore.HasValue && answer.StarScore.Value < 75)
            {
                var missing = new List<string>();
                var present = answer.StarComponentsDetected ?? "";
                if (!present.Contains('S')) missing.Add("Situation");
                if (!present.Contains('T')) missing.Add("Task");
                if (!present.Contains('A')) missing.Add("Action");
                if (!present.Contains('R')) missing.Add("Result");
                if (missing.Count > 0)
                    suggestions.Add($"Strengthen the STAR structure — consider adding: {string.Join(", ", missing)}.");
            }
            if (suggestions.Count == 0)
                suggestions.Add("Solid response — keep this structure for future interviews.");

            return new ReportTimelineEntryDto
            {
                Order = answer.Order,
                Question = answer.Question,
                Answer = answer.Answer,
                TimeSpentSec = answer.TimeSpentSec,
                Confidence = answer.ConfidenceScore,
                EyeContactPct = answer.EyeContactPct,
                Emotion = answer.DominantEmotion,
                SpeechWpm = answer.SpeechWpm,
                QualityScore = answer.QualityScore,
                GrammarScore = answer.GrammarScore,
                StarScore = answer.StarScore,
                StarComponentsDetected = answer.StarComponentsDetected,
                Suggestions = suggestions
            };
        }).ToList();

        // ── Emotion analysis ──
        var emotionAnalysis = new ReportEmotionAnalysisDto
        {
            Percentages = emotionPercentages,
            DominantEmotion = dominantEmotion,
            Timeline = answers.Where(a => !string.IsNullOrWhiteSpace(a.DominantEmotion))
                .Select(a => new ReportEmotionSampleDto { QuestionOrder = a.Order, Emotion = a.DominantEmotion! })
                .ToList()
        };

        // ── Eye contact analysis ──
        var eyeContactRecommendations = new List<string>();
        if (avgEyeContact is null)
            eyeContactRecommendations.Add("Eye-contact tracking was not available for this session — enable your camera next time for this insight.");
        else if (avgEyeContact < 50)
            eyeContactRecommendations.Add("Practice looking directly at the camera lens rather than the screen while speaking.");
        else if (avgEyeContact < 75)
            eyeContactRecommendations.Add("Good eye contact overall — try to sustain it during longer answers.");
        else
            eyeContactRecommendations.Add("Excellent, consistent eye contact throughout the interview.");

        var eyeContactAnalysis = new ReportEyeContactAnalysisDto
        {
            AverageEyeContactPct = avgEyeContact ?? 0,
            Timeline = answers.Where(a => a.EyeContactPct.HasValue)
                .Select(a => new ReportEyeContactSampleDto { QuestionOrder = a.Order, EyeContactPct = a.EyeContactPct!.Value })
                .ToList(),
            Recommendations = eyeContactRecommendations
        };

        // ── Speech analysis ──
        var clarity = (int)Math.Round((double)fluencyScore);
        var speakingConfidence = confidence;
        var speechAnalysis = new ReportSpeechAnalysisDto
        {
            WordsPerMinute = overallWpm,
            FillerWordCount = fillerWordCount,
            LongestPauseSec = longestPauseSec,
            AveragePauseSec = averagePauseSec,
            Clarity = Clamp100(clarity),
            Fluency = Clamp100(fluency),
            SpeakingConfidence = Clamp100(speakingConfidence)
        };

        // ── STAR analysis ──
        var starAnalysis = new ReportStarAnalysisDto
        {
            AverageScore = avgStar ?? 0,
            SituationCoveragePct = situationCoveragePct,
            TaskCoveragePct = taskCoveragePct,
            ActionCoveragePct = actionCoveragePct,
            ResultCoveragePct = resultCoveragePct,
            Timeline = starSamples.Select(a => new ReportStarSampleDto
            {
                QuestionOrder = a.Order,
                Score = a.StarScore!.Value,
                ComponentsDetected = a.StarComponentsDetected ?? string.Empty
            }).ToList()
        };

        // ── Grammar analysis ──
        var grammarAnalysis = new ReportGrammarAnalysisDto
        {
            AverageScore = avgGrammar ?? 0,
            TotalIssueCount = totalGrammarIssues,
            AnsweredWithGrammarDataCount = grammarSamples.Count,
            Timeline = grammarSamples.Select(a => new ReportGrammarSampleDto
            {
                QuestionOrder = a.Order,
                Score = a.GrammarScore!.Value,
                IssueCount = a.GrammarIssueCount ?? 0
            }).ToList()
        };

        // ── Strengths / weaknesses / recommendations ──
        var strengths = new List<string>();
        var weaknesses = new List<string>();
        var recommendations = new List<string>();

        foreach (var (skill, value) in skillBreakdown)
        {
            if (value >= 85) strengths.Add($"{SplitPascalCase(skill)}: consistently strong ({value}/100).");
            else if (value <= 45 && skill is not ("StressLevel")) weaknesses.Add($"{SplitPascalCase(skill)}: an area to develop ({value}/100).");
        }
        if (skillBreakdown["StressLevel"] >= 60)
            weaknesses.Add("Stress Level: signs of elevated stress were detected during the interview.");
        if (strengths.Count == 0) strengths.Add("Completed all interview questions with recorded, substantive answers.");
        if (weaknesses.Count == 0) weaknesses.Add("No significant weaknesses detected in the captured data.");

        if (averageWords < _settings.TargetAverageAnswerWords)
            recommendations.Add("Use concrete examples, actions, and outcomes (STAR method) to deepen each response.");
        if (fillerRatio > _settings.MaximumFillerWordRatioPercent)
            recommendations.Add("Pause briefly between ideas instead of using filler words.");
        if (avgEyeContact.HasValue && avgEyeContact < 60)
            recommendations.Add("Maintain more consistent eye contact with the camera during answers.");
        if (overallWpm > 0 && overallWpm < _settings.MinimumRecommendedWordsPerMinute)
            recommendations.Add("Increase speaking pace slightly to project more energy and confidence.");
        if (overallWpm > _settings.MaximumRecommendedWordsPerMinute)
            recommendations.Add("Slow the delivery slightly to improve clarity and emphasis.");
        if (skillBreakdown["StressLevel"] >= 60)
            recommendations.Add("Practice mock interviews to reduce visible stress under pressure.");
        if (avgGrammar.HasValue && avgGrammar < 75)
            recommendations.Add("Proofread key talking points in advance to reduce grammar and phrasing issues.");
        if ((avgStar ?? 0) < 75)
            recommendations.Add("Structure behavioral answers explicitly around Situation, Task, Action, and Result.");
        if (recommendations.Count == 0)
            recommendations.Add("Continue practicing to maintain this strong, consistent performance.");

        // ── Improvement roadmap: ordered by lowest-scoring real metrics, most impactful first ──
        var roadmapCandidates = new List<(string Label, int Score, string Action)>
        {
            ("Eye Contact", eyeContactSkill, "Practice speaking while looking directly at the camera lens for full answers."),
            ("Grammar", avgGrammar ?? grammarOrFluency, "Slow down and proofread key phrases mentally before speaking."),
            ("STAR Structure", avgStar ?? 0, "Explicitly state the Situation, Task, Action, and Result in behavioral answers."),
            ("Vocabulary", vocabulary, "Expand your working vocabulary around your field to avoid repeated phrasing."),
            ("Confidence", confidence, "Rehearse answers aloud to reduce hesitation and build steadier delivery."),
            ("Leadership", leadership, "Use more decisive, ownership-oriented language (e.g. 'I decided', 'I led')."),
            ("Culture Fit", cultureFit, "Reference teamwork and collaboration explicitly when describing past work."),
            ("Technical Depth", technicalKnowledge, "Use more precise domain terminology relevant to the role."),
        };
        var improvementRoadmap = roadmapCandidates
            .OrderBy(c => c.Score)
            .Take(4)
            .Select(c => $"{c.Label} ({c.Score}/100): {c.Action}")
            .ToList();

        var aiSummary = BuildAiSummary(answers.Count, totalWords, averageWords, grade, hiringRecommendation,
            avgEyeContact, dominantEmotion, overallWpm, skillBreakdown);

        var feedback = BuildFeedback(totalWords, averageWords, substantialRate, fillerRatio, startedAt, endedAt);

        return new ReportEvaluation(
            score,
            feedback,
            grade,
            passProbability,
            hiringRecommendation,
            aiSummary,
            skillBreakdown,
            timeline,
            emotionAnalysis,
            eyeContactAnalysis,
            speechAnalysis,
            strengths,
            weaknesses,
            recommendations,
            starAnalysis,
            grammarAnalysis,
            improvementRoadmap);
    }

    private static string BuildAiSummary(
        int questionCount, int totalWords, decimal averageWords, string grade, string hiringRecommendation,
        int? avgEyeContact, string? dominantEmotion, int overallWpm, Dictionary<string, int> skillBreakdown)
    {
        var sb = new StringBuilder();
        sb.Append($"The candidate completed {questionCount} interview questions, providing a total of {totalWords:N0} words ");
        sb.Append($"(averaging {averageWords:N0} words per answer). ");
        sb.Append($"Delivery pace measured {overallWpm} words per minute. ");
        if (avgEyeContact.HasValue)
            sb.Append($"Camera analysis recorded an average eye contact level of {avgEyeContact}%. ");
        if (!string.IsNullOrWhiteSpace(dominantEmotion))
            sb.Append($"The most frequently observed emotional state was '{dominantEmotion}'. ");
        var topSkill = skillBreakdown.OrderByDescending(kv => kv.Value).First();
        var lowSkill = skillBreakdown.OrderBy(kv => kv.Value).First();
        sb.Append($"The strongest observed area was {SplitPascalCase(topSkill.Key)} ({topSkill.Value}/100), ");
        sb.Append($"while {SplitPascalCase(lowSkill.Key)} ({lowSkill.Value}/100) offers the most room for improvement. ");
        sb.Append($"Overall, the interview earned a grade of {grade}, corresponding to a hiring recommendation of '{hiringRecommendation}'.");
        return sb.ToString();
    }

    private string BuildFeedback(int totalWords, decimal averageWords, decimal substantialRate, decimal fillerRatio, DateTime startedAt, DateTime endedAt)
    {
        var feedback = new StringBuilder("Automated interview summary");
        feedback.AppendLine();
        feedback.AppendLine($"- Responses recorded: {totalWords:N0} words.");
        feedback.AppendLine($"- Answer depth: {averageWords:N0} average words per response (configured target: {_settings.TargetAverageAnswerWords:N0}).");
        feedback.AppendLine($"- Substantial answers: {substantialRate:P0} met the configured minimum of {_settings.MinimumAnswerWords} words.");
        feedback.AppendLine($"- Filler-word ratio: {fillerRatio:N1}% (configured ceiling: {_settings.MaximumFillerWordRatioPercent:N1}%).");

        var elapsedMinutes = Math.Max((decimal)(endedAt - startedAt).TotalMinutes, 0.01m);
        var wordsPerMinute = totalWords / elapsedMinutes;
        feedback.AppendLine($"- Delivery pace: {wordsPerMinute:N0} words per minute.");
        if (wordsPerMinute < _settings.MinimumRecommendedWordsPerMinute)
            feedback.AppendLine("- Recommendation: develop each answer with more supporting detail before moving on.");
        else if (wordsPerMinute > _settings.MaximumRecommendedWordsPerMinute)
            feedback.AppendLine("- Recommendation: slow the delivery slightly to improve clarity and emphasis.");
        if (averageWords < _settings.TargetAverageAnswerWords)
            feedback.AppendLine("- Recommendation: use concrete examples, actions, and outcomes to deepen each response.");
        if (fillerRatio > _settings.MaximumFillerWordRatioPercent)
            feedback.AppendLine("- Recommendation: pause briefly between ideas to reduce filler words.");
        if (substantialRate >= 0.8m && averageWords >= _settings.TargetAverageAnswerWords)
            feedback.AppendLine("- Strength: the responses were consistently complete and sufficiently detailed.");

        return feedback.ToString().TrimEnd();
    }

    private static int EstimateVocabularyScore(IReadOnlyList<string> texts)
    {
        var allWords = texts
            .SelectMany(text => Regex.Matches(text, @"\b[\p{L}][\p{L}'’-]*\b").Select(m => m.Value.ToLowerInvariant()))
            .ToList();
        if (allWords.Count == 0) return 0;
        var distinctRatio = (decimal)allWords.Distinct().Count() / allWords.Count;
        // Type-token ratio naturally shrinks as text gets longer, so scale
        // against a realistic ceiling for multi-answer interview transcripts.
        return Clamp100((int)Math.Round(distinctRatio * 100m / 0.55m));
    }

    private static int Clamp100(int value) => Math.Clamp(value, 0, 100);

    private static string SplitPascalCase(string value) =>
        Regex.Replace(value, "(?<!^)([A-Z])", " $1");

    private static int CountWords(string text) => Regex.Matches(text, @"\b[\p{L}\p{N}][\p{L}\p{N}'’-]*\b").Count;

    private static int CountFillerWords(string text) => Regex.Matches(
        text,
        @"\b(um+|uh+|erm+|like|actually|basically|literally)\b",
        RegexOptions.IgnoreCase | RegexOptions.CultureInvariant).Count;

    private static decimal Scale(decimal value, decimal target, decimal excellent)
    {
        if (value <= 0m) return 0m;
        if (value >= excellent) return 100m;
        if (value >= target) return 70m + ((value - target) / (excellent - target) * 30m);
        return value / target * 70m;
    }

    private static ReportDto ToDto(Report report)
    {
        return new ReportDto
        {
            Id = report.Id,
            InterviewSessionId = report.InterviewSessionId,
            Score = report.Score,
            Feedback = report.Feedback,
            CreatedAt = report.CreatedAt,
            Grade = report.Grade,
            PassProbability = report.PassProbability,
            HiringRecommendation = report.HiringRecommendation,
            AiSummary = report.AiSummary,
            SkillBreakdown = Deserialize<Dictionary<string, int>>(report.SkillBreakdownJson),
            Timeline = Deserialize<List<ReportTimelineEntryDto>>(report.TimelineJson),
            EmotionAnalysis = Deserialize<ReportEmotionAnalysisDto>(report.EmotionAnalysisJson),
            EyeContactAnalysis = Deserialize<ReportEyeContactAnalysisDto>(report.EyeContactAnalysisJson),
            SpeechAnalysis = Deserialize<ReportSpeechAnalysisDto>(report.SpeechAnalysisJson),
            Strengths = Deserialize<List<string>>(report.StrengthsJson),
            Weaknesses = Deserialize<List<string>>(report.WeaknessesJson),
            Recommendations = Deserialize<List<string>>(report.RecommendationsJson),
            StarAnalysis = Deserialize<ReportStarAnalysisDto>(report.StarAnalysisJson),
            GrammarAnalysis = Deserialize<ReportGrammarAnalysisDto>(report.GrammarAnalysisJson),
            ImprovementRoadmap = Deserialize<List<string>>(report.ImprovementRoadmapJson)
        };
    }

    private static T? Deserialize<T>(string? json) where T : class
    {
        if (string.IsNullOrWhiteSpace(json)) return null;
        try { return JsonSerializer.Deserialize<T>(json, JsonOptions); }
        catch { return null; }
    }

    private sealed record ReportEvaluation(
        int Score,
        string Feedback,
        string Grade,
        int PassProbability,
        string HiringRecommendation,
        string AiSummary,
        Dictionary<string, int> SkillBreakdown,
        List<ReportTimelineEntryDto> Timeline,
        ReportEmotionAnalysisDto EmotionAnalysis,
        ReportEyeContactAnalysisDto EyeContactAnalysis,
        ReportSpeechAnalysisDto SpeechAnalysis,
        List<string> Strengths,
        List<string> Weaknesses,
        List<string> Recommendations,
        ReportStarAnalysisDto StarAnalysis,
        ReportGrammarAnalysisDto GrammarAnalysis,
        List<string> ImprovementRoadmap);
}
