using System.Text;
using System.Text.Json;

using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;

using SilentInterview.Application.Common.Interfaces;
using SilentInterview.Application.DTOs.AI;
using SilentInterview.Application.Interfaces;
using SilentInterview.Application.Settings;
using SilentInterview.Domain.Entities;
using SilentInterview.Infrastructure.AI.Prompts;
using SilentInterview.Infrastructure.Persistence;

namespace SilentInterview.Infrastructure.AI;

/// <summary>
/// Produces the enterprise AI hiring report. Combines the deterministic signals
/// already captured by ReportService (camera, speech, per-answer metrics) with
/// the stored AIAnswerEvaluations and the full transcript, reasoning over all of
/// it via the configured report model (Gemini Flash by default via OpenRouter).
/// </summary>
public sealed class ReportAIService : IReportAIService
{
    private readonly SilentInterviewDbContext _context;
    private readonly IOpenRouterService _openRouter;
    private readonly OpenRouterSettings _settings;
    private readonly ILogger<ReportAIService> _logger;
    private static readonly JsonSerializerOptions JsonOptions = new(JsonSerializerDefaults.Web);

    public ReportAIService(
        SilentInterviewDbContext context,
        IOpenRouterService openRouter,
        IOptions<OpenRouterSettings> settings,
        ILogger<ReportAIService> logger)
    {
        _context = context;
        _openRouter = openRouter;
        _settings = settings.Value;
        _logger = logger;
    }

    public async Task<AIReportDto> GenerateAsync(
        GenerateAIReportRequest request,
        Guid? scopeCompanyId,
        Guid? scopeCandidateUserId,
        CancellationToken cancellationToken = default)
    {
        var session = await LoadScopedSessionAsync(
            request.InterviewSessionId, scopeCompanyId, scopeCandidateUserId, cancellationToken)
            ?? throw new InvalidOperationException("Interview session not found.");

        if (session.EndedAt is null)
        {
            throw new InvalidOperationException("An AI report can only be generated after the interview has finished.");
        }

        // Auto-generate the deterministic base report if it doesn't exist yet,
        // so the caller doesn't have to hit a separate endpoint first.
        var report = await _context.Reports
            .FirstOrDefaultAsync(r => r.InterviewSessionId == session.Id, cancellationToken);

        if (report is null)
        {
            throw new InvalidOperationException(
                "No deterministic report exists yet for this session. Generate the base report first via POST /api/v1/Report/generate/{sessionId}.");
        }

        var plan = await _context.AIInterviewPlans
            .FirstOrDefaultAsync(p => p.InterviewSessionId == session.Id, cancellationToken);

        var language = LanguageMap.Normalize(request.Language ?? plan?.Language);
        var languageName = LanguageMap.Name(language);

        var answers = await _context.InterviewAnswers
            .AsNoTracking()
            .Where(a => a.InterviewSessionId == session.Id)
            .OrderBy(a => a.Order)
            .ToListAsync(cancellationToken);

        var answerIds = answers.Select(a => a.Id).ToList();
        var evaluations = await _context.AIAnswerEvaluations
            .AsNoTracking()
            .Where(e => answerIds.Contains(e.InterviewAnswerId))
            .ToListAsync(cancellationToken);
        var evaluationsByAnswer = evaluations.ToDictionary(e => e.InterviewAnswerId);

        var job = session.JobApplication.Job;
        var candidate = session.JobApplication.Candidate;

        var transcriptAndEvaluations = BuildTranscriptBlock(answers, evaluationsByAnswer);
        var deterministicSignals = BuildDeterministicSignalsBlock(report);

        var systemPrompt = ReportAIPromptBuilder.BuildSystem(languageName);
        var userPrompt = ReportAIPromptBuilder.BuildUser(
            job.Title,
            string.IsNullOrWhiteSpace(candidate.Skills) ? "Not provided" : candidate.Skills,
            string.IsNullOrWhiteSpace(candidate.Experience) ? "Not provided" : candidate.Experience,
            transcriptAndEvaluations,
            deterministicSignals,
            languageName);

        AIReportRaw raw;
        bool aiSucceeded;
        try
        {
            var content = await _openRouter.CompleteAsync(
                _settings.ReportModel,
                systemPrompt,
                userPrompt,
                _settings.ReportMaxTokens,
                temperature: 0.3,
                jsonMode: true,
                cancellationToken: cancellationToken);

            raw = ParseReport(content);
            aiSucceeded = true;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex,
                "AI report generation failed for session {SessionId}. Falling back to deterministic report data.",
                session.Id);
            raw = BuildFallbackReport(report, answers, evaluationsByAnswer);
            aiSucceeded = false;
        }

        report.AiReportJson = JsonSerializer.Serialize(raw, JsonOptions);
        report.AiReportLanguage = language;
        report.AiReportGeneratedByModel = aiSucceeded ? _settings.ReportModel : "deterministic-fallback";
        report.AiReportGeneratedAt = DateTime.UtcNow;

        await _context.SaveChangesAsync(cancellationToken);

        return ToDto(report.Id, session.Id, language, raw, report.AiReportGeneratedByModel, report.AiReportGeneratedAt.Value, aiSucceeded);
    }

    public async Task<AIReportDto?> GetAsync(
        Guid interviewSessionId,
        Guid? scopeCompanyId,
        Guid? scopeCandidateUserId,
        CancellationToken cancellationToken = default)
    {
        var query = _context.Reports.AsNoTracking()
            .Where(r => r.InterviewSessionId == interviewSessionId);

        if (scopeCompanyId.HasValue)
        {
            query = query.Where(r => r.InterviewSession.JobApplication.Job.CompanyId == scopeCompanyId.Value);
        }

        if (scopeCandidateUserId.HasValue)
        {
            query = query.Where(r => r.InterviewSession.JobApplication.Candidate.UserId == scopeCandidateUserId.Value);
        }

        var report = await query.FirstOrDefaultAsync(cancellationToken);

        if (report is null || string.IsNullOrWhiteSpace(report.AiReportJson))
        {
            return null;
        }

        var raw = JsonSerializer.Deserialize<AIReportRaw>(report.AiReportJson, JsonOptions);
        if (raw is null) return null;

        var isFallback = report.AiReportGeneratedByModel == "deterministic-fallback";

        return ToDto(
            report.Id,
            interviewSessionId,
            report.AiReportLanguage ?? "en",
            raw,
            report.AiReportGeneratedByModel ?? string.Empty,
            report.AiReportGeneratedAt ?? report.CreatedAt,
            !isFallback);
    }

    private async Task<InterviewSession?> LoadScopedSessionAsync(
        Guid interviewSessionId, Guid? scopeCompanyId, Guid? scopeCandidateUserId, CancellationToken cancellationToken)
    {
        var query = _context.InterviewSessions
            .Include(s => s.JobApplication).ThenInclude(a => a.Job)
            .Include(s => s.JobApplication).ThenInclude(a => a.Candidate)
            .Where(s => s.Id == interviewSessionId);

        if (scopeCompanyId.HasValue)
        {
            query = query.Where(s => s.JobApplication.Job.CompanyId == scopeCompanyId.Value);
        }

        if (scopeCandidateUserId.HasValue)
        {
            query = query.Where(s => s.JobApplication.Candidate.UserId == scopeCandidateUserId.Value);
        }

        return await query.FirstOrDefaultAsync(cancellationToken);
    }

    private static string BuildTranscriptBlock(
        List<InterviewAnswer> answers, Dictionary<Guid, AIAnswerEvaluation> evaluationsByAnswer)
    {
        var sb = new StringBuilder();
        foreach (var answer in answers)
        {
            // Truncate long answers to keep prompt within token budget
            var truncatedAnswer = TruncateText(answer.Answer, 200);
            sb.AppendLine($"[Q{answer.Order}] {answer.Question}");
            sb.AppendLine($"[A{answer.Order}] {truncatedAnswer}");

            if (evaluationsByAnswer.TryGetValue(answer.Id, out var evaluation))
            {
                sb.AppendLine(
                    $"  eval: tech={evaluation.TechnicalAccuracy} comm={evaluation.CommunicationScore} " +
                    $"depth={evaluation.DepthScore} | {TruncateText(evaluation.AiComment, 80)}");
            }

            sb.AppendLine();
        }
        return sb.ToString();
    }

    private static string TruncateText(string? text, int maxChars)
    {
        if (string.IsNullOrWhiteSpace(text)) return string.Empty;
        return text.Length <= maxChars ? text : text[..maxChars] + "…";
    }

    private static string BuildDeterministicSignalsBlock(Report report)
    {
        var sb = new StringBuilder();
        sb.AppendLine($"Deterministic overall score: {report.Score}/100, grade: {report.Grade ?? "N/A"}");
        sb.AppendLine($"Deterministic pass probability: {report.PassProbability?.ToString() ?? "N/A"}");
        sb.AppendLine($"Deterministic hiring recommendation: {report.HiringRecommendation ?? "N/A"}");
        if (!string.IsNullOrWhiteSpace(report.SkillBreakdownJson))
            sb.AppendLine($"Skill breakdown: {report.SkillBreakdownJson}");
        if (!string.IsNullOrWhiteSpace(report.EmotionAnalysisJson))
            sb.AppendLine($"Emotion analysis: {report.EmotionAnalysisJson}");
        if (!string.IsNullOrWhiteSpace(report.EyeContactAnalysisJson))
            sb.AppendLine($"Eye contact analysis: {report.EyeContactAnalysisJson}");
        if (!string.IsNullOrWhiteSpace(report.SpeechAnalysisJson))
            sb.AppendLine($"Speech analysis: {report.SpeechAnalysisJson}");
        if (!string.IsNullOrWhiteSpace(report.StarAnalysisJson))
            sb.AppendLine($"STAR framework analysis: {report.StarAnalysisJson}");
        if (!string.IsNullOrWhiteSpace(report.GrammarAnalysisJson))
            sb.AppendLine($"Grammar analysis: {report.GrammarAnalysisJson}");
        return sb.ToString();
    }

    private static AIReportRaw ParseReport(string content)
    {
        var json = ExtractJson(content);
        return JsonSerializer.Deserialize<AIReportRaw>(json, JsonOptions)
            ?? throw new InvalidOperationException("AI returned an empty report.");
    }

    private static string ExtractJson(string content)
    {
        var trimmed = content.Trim();
        if (trimmed.StartsWith('{')) return trimmed;

        var start = trimmed.IndexOf('{');
        var end = trimmed.LastIndexOf('}');
        if (start >= 0 && end > start) return trimmed[start..(end + 1)];

        throw new InvalidOperationException("AI response did not contain valid JSON.");
    }

    /// <summary>
    /// Builds a transparent fallback report when the AI provider is unavailable.
    /// It avoids presenting camera-derived scores as evidence of leadership, culture,
    /// or hiring suitability. ConfidenceScore retains its DTO compatibility meaning,
    /// but the candidate-facing UI does not display it for fallback reports.
    /// </summary>
    private static AIReportRaw BuildFallbackReport(
        Report report,
        List<InterviewAnswer> answers,
        Dictionary<Guid, AIAnswerEvaluation> evaluationsByAnswer)
    {
        var skillBreakdown = TryDeserialize<Dictionary<string, int>>(report.SkillBreakdownJson);
        var speechAnalysis = TryDeserialize<Dictionary<string, JsonElement>>(report.SpeechAnalysisJson);

        // --- Candidate Profile: built from captured metrics ---
        var profileSb = new StringBuilder();
        profileSb.Append($"The candidate completed {answers.Count} interview question(s)");
        if (answers.Count > 0)
        {
            var totalWords = answers.Sum(a => CountWords(a.Answer));
            profileSb.Append($", providing approximately {totalWords:N0} words in total");
        }
        profileSb.AppendLine(".");
        profileSb.Append("Candidate profile details and role-relevant strengths were not fully assessed in fallback mode; review the recorded answers directly.");

        // --- Technical Analysis ---
        var techSb = new StringBuilder();
        if (skillBreakdown != null && skillBreakdown.TryGetValue("TechnicalKnowledge", out var techScore))
            techSb.AppendLine($"Technical Knowledge score: {techScore}/100.");
        if (skillBreakdown != null && skillBreakdown.TryGetValue("Vocabulary", out var vocabScore))
            techSb.AppendLine($"Vocabulary breadth score: {vocabScore}/100.");

        // Include any per-answer AI evaluations if they exist
        var evalComments = answers
            .Where(a => evaluationsByAnswer.ContainsKey(a.Id))
            .Select(a => (a.Order, evaluationsByAnswer[a.Id]))
            .ToList();
        if (evalComments.Any())
        {
            techSb.AppendLine("Per-answer evaluations:");
            foreach (var (order, eval) in evalComments)
                techSb.AppendLine($"  Q{order}: tech={eval.TechnicalAccuracy}/100, depth={eval.DepthScore}/100.");
        }
        if (techSb.Length == 0)
            techSb.Append("Technical metrics were not fully captured for this session.");
        techSb.Append(" (AI narrative unavailable — derived from deterministic scoring only.)");

        // --- Communication Analysis ---
        var commSb = new StringBuilder();
        if (skillBreakdown != null && skillBreakdown.TryGetValue("Communication", out var commScore))
            commSb.AppendLine($"Communication score: {commScore}/100.");
        if (skillBreakdown != null && skillBreakdown.TryGetValue("Fluency", out var fluencyScore))
            commSb.AppendLine($"Fluency score: {fluencyScore}/100.");
        if (skillBreakdown != null && skillBreakdown.TryGetValue("Grammar", out var grammarScore))
            commSb.AppendLine($"Grammar score: {grammarScore}/100.");
        if (speechAnalysis != null && speechAnalysis.TryGetValue("wordsPerMinute", out var wpm))
            commSb.AppendLine($"Speech pace: {wpm} words per minute.");
        if (speechAnalysis != null && speechAnalysis.TryGetValue("fillerWordCount", out var fillers))
            commSb.AppendLine($"Filler word count: {fillers}.");
        if (commSb.Length == 0)
            commSb.Append("Communication metrics were not fully captured for this session.");
        commSb.Append(" (AI narrative unavailable — derived from deterministic scoring only.)");

        // --- Behavioral Analysis ---
        var behavSb = new StringBuilder();
        if (skillBreakdown != null && skillBreakdown.TryGetValue("StarStructure", out var starScore))
            behavSb.AppendLine($"STAR framework average score: {starScore}/100.");
        if (behavSb.Length == 0)
            behavSb.Append("Behavioral metrics were not fully captured for this session.");
        behavSb.Append(" (AI narrative unavailable — derived from deterministic scoring only.)");

        // --- Leadership Analysis ---
        var leadSb = new StringBuilder();
        leadSb.Append("Leadership cannot be assessed reliably in fallback mode without answer-specific evidence. ");
        leadSb.Append("Camera-derived confidence, emotion, and eye-contact signals are not leadership evidence.");

        // Fallback strengths and gaps must come from answer-text evaluations only,
        // not from aggregate scores that may contain camera-derived proxies.
        var strengths = answers
            .Where(a => evaluationsByAnswer.ContainsKey(a.Id))
            .SelectMany(a => TryDeserialize<List<string>>(evaluationsByAnswer[a.Id].StrengthsJson) ?? new List<string>())
            .Where(item => !string.IsNullOrWhiteSpace(item))
            .Distinct(StringComparer.OrdinalIgnoreCase)
            .Take(5)
            .ToList();
        var weaknesses = answers
            .Where(a => evaluationsByAnswer.ContainsKey(a.Id))
            .SelectMany(a => TryDeserialize<List<string>>(evaluationsByAnswer[a.Id].WeaknessesJson) ?? new List<string>())
            .Where(item => !string.IsNullOrWhiteSpace(item))
            .Distinct(StringComparer.OrdinalIgnoreCase)
            .Take(5)
            .ToList();
        // Deterministic confidence: use PassProbability as proxy since AI confidence is genuinely unknown
        var deterministicConfidence = report.PassProbability ?? report.Score;

        return new AIReportRaw
        {
            ExecutiveSummary = $"Interview completed. Session score: {report.Score}/100 (Grade: {report.Grade ?? "N/A"}). " +
                "AI narrative generation is temporarily unavailable. This fallback contains limited session metrics and should be used for practice feedback only, not as a hiring decision.",
            HiringRecommendation = report.HiringRecommendation ?? "Needs Review",
            HiringRecommendationReason = $"Derived from deterministic scoring only (score: {report.Score}/100). " +
                "AI narrative generation failed — the recommendation above reflects the algorithmic assessment based on captured interview metrics.",
            IsFallback = true,
            CandidateProfile = profileSb.ToString().Trim(),
            TechnicalAnalysis = techSb.ToString().Trim(),
            CommunicationAnalysis = commSb.ToString().Trim(),
            BehaviorAnalysis = behavSb.ToString().Trim(),
            LeadershipAnalysis = leadSb.ToString().Trim(),
            CultureFit = "Collaboration evidence was not assessed in fallback mode. Cultural similarity is not a job-related scoring criterion.",
            ProblemSolving = "Problem-solving ability cannot be reliably assessed in fallback mode. Review the reasoning steps and evidence in the recorded answers.",
            Strengths = strengths.Count > 0 ? strengths : new List<string>(),
            Weaknesses = weaknesses,
            RiskFactors = new List<string>(),
            LearningPotential = "Learning and adaptation cannot be assessed from the available fallback metrics. Review concrete examples in the recorded answers.",
            SalaryEstimation = "Not assessed. Salary expectations, location, and reliable market-range data were not provided.",
            RoleMatch = "A reliable role match cannot be established in fallback mode. The full job description and answer-specific evidence need human review.",
            NextInterviewRecommendation = "Detailed next-step recommendations require AI analysis. Please retry report generation.",
            CustomFollowUpQuestions = new List<string>(),
            ConfidenceScore = deterministicConfidence
        };
    }

    private static AIReportDto ToDto(
        Guid reportId, Guid sessionId, string language, AIReportRaw raw, string model, DateTime generatedAt, bool aiSucceeded) => new()
    {
        ReportId = reportId,
        InterviewSessionId = sessionId,
        Language = language,
        ExecutiveSummary = raw.ExecutiveSummary ?? string.Empty,
        HiringRecommendation = raw.HiringRecommendation ?? string.Empty,
        HiringRecommendationReason = raw.HiringRecommendationReason ?? string.Empty,
        IsFallback = raw.IsFallback || !aiSucceeded,
        CandidateProfile = raw.CandidateProfile ?? string.Empty,
        TechnicalAnalysis = raw.TechnicalAnalysis ?? string.Empty,
        CommunicationAnalysis = raw.CommunicationAnalysis ?? string.Empty,
        BehaviorAnalysis = raw.BehaviorAnalysis ?? string.Empty,
        LeadershipAnalysis = raw.LeadershipAnalysis ?? string.Empty,
        CultureFit = raw.CultureFit ?? string.Empty,
        ProblemSolving = raw.ProblemSolving ?? string.Empty,
        Strengths = raw.Strengths ?? new List<string>(),
        Weaknesses = raw.Weaknesses ?? new List<string>(),
        RiskFactors = raw.RiskFactors ?? new List<string>(),
        LearningPotential = raw.LearningPotential ?? string.Empty,
        SalaryEstimation = raw.SalaryEstimation ?? string.Empty,
        RoleMatch = raw.RoleMatch ?? string.Empty,
        NextInterviewRecommendation = raw.NextInterviewRecommendation ?? string.Empty,
        CustomFollowUpQuestions = raw.CustomFollowUpQuestions ?? new List<string>(),
        ConfidenceScore = Math.Clamp(raw.ConfidenceScore, 0, 100),
        GeneratedByModel = model,
        GeneratedAt = generatedAt
    };

    private static T? TryDeserialize<T>(string? json) where T : class
    {
        if (string.IsNullOrWhiteSpace(json)) return null;
        try { return JsonSerializer.Deserialize<T>(json, JsonOptions); }
        catch { return null; }
    }

    private static int CountWords(string? text)
    {
        if (string.IsNullOrWhiteSpace(text)) return 0;
        return System.Text.RegularExpressions.Regex
            .Matches(text, @"\b[\p{L}\p{N}][\p{L}\p{N}''-]*\b").Count;
    }

    private static string SplitPascalCase(string value) =>
        System.Text.RegularExpressions.Regex.Replace(value, "(?<!^)([A-Z])", " $1");

    private sealed class AIReportRaw
    {
        public string? ExecutiveSummary { get; set; }
        public string? HiringRecommendation { get; set; }
        public string? HiringRecommendationReason { get; set; }
        /// <summary>True when this report was produced by the deterministic fallback path, not real AI generation.</summary>
        public bool IsFallback { get; set; }
        public string? CandidateProfile { get; set; }
        public string? TechnicalAnalysis { get; set; }
        public string? CommunicationAnalysis { get; set; }
        public string? BehaviorAnalysis { get; set; }
        public string? LeadershipAnalysis { get; set; }
        public string? CultureFit { get; set; }
        public string? ProblemSolving { get; set; }
        public List<string>? Strengths { get; set; }
        public List<string>? Weaknesses { get; set; }
        public List<string>? RiskFactors { get; set; }
        public string? LearningPotential { get; set; }
        public string? SalaryEstimation { get; set; }
        public string? RoleMatch { get; set; }
        public string? NextInterviewRecommendation { get; set; }
        public List<string>? CustomFollowUpQuestions { get; set; }
        public int ConfidenceScore { get; set; }
    }
}
