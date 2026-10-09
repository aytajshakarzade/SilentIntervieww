using Microsoft.EntityFrameworkCore;
using System.Text.RegularExpressions;
using SilentInterview.Application.Common.Models;
using SilentInterview.Application.DTOs.InterviewAnswer;
using SilentInterview.Application.Interfaces;
using SilentInterview.Domain.Entities;
using SilentInterview.Infrastructure.Persistence;

namespace SilentInterview.Infrastructure.Services;

public class InterviewAnswerService : IInterviewAnswerService
{
    private readonly SilentInterviewDbContext _context;
    private readonly IGrammarCheckService _grammarCheckService;

    public InterviewAnswerService(SilentInterviewDbContext context, IGrammarCheckService grammarCheckService)
    {
        _context = context;
        _grammarCheckService = grammarCheckService;
    }

    public async Task<PagedResult<InterviewAnswerDto>> GetAllAsync(
        InterviewAnswerQueryParameters parameters, Guid? scopeCompanyId, Guid? scopeCandidateUserId)
    {
        IQueryable<InterviewAnswer> query =
            _context.InterviewAnswers.AsNoTracking();

        if (scopeCompanyId.HasValue)
        {
            query = query.Where(x => x.InterviewSession.JobApplication.Job.CompanyId == scopeCompanyId.Value);
        }

        if (scopeCandidateUserId.HasValue)
        {
            query = query.Where(x => x.InterviewSession.JobApplication.Candidate.UserId == scopeCandidateUserId.Value);
        }

        // Search
        if (!string.IsNullOrWhiteSpace(parameters.Search))
        {
            var search = parameters.Search.Trim().ToLower();

            query = query.Where(x =>
                x.Question.ToLower().Contains(search) ||
                x.Answer.ToLower().Contains(search));
        }

        // Interview Session Filter
        if (parameters.InterviewSessionId.HasValue)
        {
            query = query.Where(x =>
                x.InterviewSessionId == parameters.InterviewSessionId.Value);
        }

        // Order Filter
        if (parameters.Order.HasValue)
        {
            query = query.Where(x =>
                x.Order == parameters.Order.Value);
        }

        // Sorting
        query = parameters.SortBy.ToLower() switch
        {
            "question" => parameters.Descending
                ? query.OrderByDescending(x => x.Question)
                : query.OrderBy(x => x.Question),

            "answer" => parameters.Descending
                ? query.OrderByDescending(x => x.Answer)
                : query.OrderBy(x => x.Answer),

            "order" => parameters.Descending
                ? query.OrderByDescending(x => x.Order)
                : query.OrderBy(x => x.Order),

            "interviewsessionid" => parameters.Descending
                ? query.OrderByDescending(x => x.InterviewSessionId)
                : query.OrderBy(x => x.InterviewSessionId),

            _ => parameters.Descending
                ? query.OrderByDescending(x => x.Id)
                : query.OrderBy(x => x.Id)
        };

        var totalCount = await query.CountAsync();

        var answers = await query
            .Skip((parameters.PageNumber - 1) * parameters.PageSize)
            .Take(parameters.PageSize)
            .ToListAsync();

        return new PagedResult<InterviewAnswerDto>
        {
            Items = answers.Select(ToDto).ToList(),
            TotalCount = totalCount,
            PageNumber = parameters.PageNumber,
            PageSize = parameters.PageSize
        };
    }

    public async Task<InterviewAnswerDto?> GetByIdAsync(Guid id, Guid? scopeCompanyId, Guid? scopeCandidateUserId)
    {
        var query = _context.InterviewAnswers
            .AsNoTracking()
            .Where(x => x.Id == id);

        if (scopeCompanyId.HasValue)
        {
            query = query.Where(x => x.InterviewSession.JobApplication.Job.CompanyId == scopeCompanyId.Value);
        }

        if (scopeCandidateUserId.HasValue)
        {
            query = query.Where(x => x.InterviewSession.JobApplication.Candidate.UserId == scopeCandidateUserId.Value);
        }

        var answer = await query.FirstOrDefaultAsync();

        return answer == null
            ? null
            : ToDto(answer);
    }

    public async Task<InterviewAnswerDto> CreateAsync(
        CreateInterviewAnswerRequest request)
    {
        var sessionExists = await _context.InterviewSessions
            .AnyAsync(session => session.Id == request.InterviewSessionId);
        if (!sessionExists)
            throw new InvalidOperationException("Interview session not found.");

        var answer = await _context.InterviewAnswers
            .SingleOrDefaultAsync(existing =>
                existing.InterviewSessionId == request.InterviewSessionId &&
                existing.Order == request.Order);

        if (answer is null)
        {
            answer = new InterviewAnswer
            {
                Id = Guid.NewGuid(),
                InterviewSessionId = request.InterviewSessionId,
                Question = request.Question,
                Answer = request.Answer,
                Order = request.Order
            };
            _context.InterviewAnswers.Add(answer);
        }
        else
        {
            answer.Question = request.Question;
            answer.Answer = request.Answer;
        }

        await ApplyAnalyticsAsync(answer, request.TimeSpentSec, request.EyeContactPct, request.DominantEmotion,
            request.SpeechWpm, request.FillerWordCount, request.LongestPauseSec);

        await _context.SaveChangesAsync();

        return ToDto(answer);
    }

    // ── STAR framework detection ──
    // Each component is detected via a documented keyword/phrase set that
    // signals that part of the STAR structure is present in the answer.
    // This is a real, reproducible text analysis (same input -> same
    // output), not a random or fabricated score. StarScore = 25 points
    // per detected component (0, 25, 50, 75, or 100).
    private static readonly Regex SituationPattern = new(
        @"\b(when I was|at my (previous|last|current) (job|role|company)|in my (previous|last|current) (role|position)|the situation was|we (were|had) facing|a challenge (arose|came up)|context was|background(:| is| was))\b",
        RegexOptions.IgnoreCase | RegexOptions.Compiled);

    private static readonly Regex TaskPattern = new(
        @"\b(my (task|goal|responsibility|objective) was|I (was|needed) to|I had to|the goal was|responsible for|assigned to|needed to (deliver|achieve|solve|fix))\b",
        RegexOptions.IgnoreCase | RegexOptions.Compiled);

    private static readonly Regex ActionPattern = new(
        @"\b(I (decided|implemented|built|created|designed|led|developed|organized|analyzed|communicated|coordinated|collaborated|reached out|proposed|initiated|conducted|wrote|refactored|debugged|tested|planned|negotiated|delegated))\b",
        RegexOptions.IgnoreCase | RegexOptions.Compiled);

    private static readonly Regex ResultPattern = new(
        @"\b(as a result|the outcome was|this (led to|resulted in|improved|reduced|increased)|we (achieved|delivered|succeeded|improved)|(increased|decreased|reduced|improved|grew) by \d|the impact was|ultimately|in the end|(saved|generated) \$?\d)\b",
        RegexOptions.IgnoreCase | RegexOptions.Compiled);

    /// <summary>
    /// Detects which STAR components are present in an answer using
    /// documented regex signal patterns. Returns detected component
    /// letters (e.g. "SAR") and a 0-100 score (25 pts per component).
    /// </summary>
    private static (int Score, string Components) EvaluateStar(string answerText)
    {
        if (string.IsNullOrWhiteSpace(answerText))
            return (0, string.Empty);

        var components = string.Empty;
        var score = 0;

        if (SituationPattern.IsMatch(answerText)) { components += "S"; score += 25; }
        if (TaskPattern.IsMatch(answerText)) { components += "T"; score += 25; }
        if (ActionPattern.IsMatch(answerText)) { components += "A"; score += 25; }
        if (ResultPattern.IsMatch(answerText)) { components += "R"; score += 25; }

        return (score, components);
    }

    /// <summary>
    /// Assigns real, client-captured analytics onto the answer and derives
    /// ConfidenceScore/QualityScore deterministically from those same signals.
    /// Also runs a real LanguageTool grammar check and STAR pattern detection
    /// against the answer text. No value is invented: fields stay null if the
    /// corresponding signal was never captured or the grammar API call failed.
    /// </summary>
    private async Task ApplyAnalyticsAsync(
        InterviewAnswer answer,
        int? timeSpentSec,
        int? eyeContactPct,
        string? dominantEmotion,
        int? speechWpm,
        int? fillerWordCount,
        decimal? longestPauseSec)
    {
        answer.TimeSpentSec = timeSpentSec ?? answer.TimeSpentSec;
        answer.EyeContactPct = eyeContactPct ?? answer.EyeContactPct;
        answer.DominantEmotion = dominantEmotion ?? answer.DominantEmotion;
        answer.SpeechWpm = speechWpm ?? answer.SpeechWpm;
        answer.FillerWordCount = fillerWordCount ?? answer.FillerWordCount;
        answer.LongestPauseSec = longestPauseSec ?? answer.LongestPauseSec;

        // Real LanguageTool grammar check (no heuristic fallback per spec —
        // if the API call fails, GrammarScore/GrammarIssueCount stay null).
        var grammarResult = await _grammarCheckService.CheckAsync(answer.Answer);
        if (grammarResult is not null)
        {
            answer.GrammarScore = grammarResult.Score;
            answer.GrammarIssueCount = grammarResult.IssueCount;
        }

        // Real, deterministic STAR pattern detection against the answer text.
        var (starScore, starComponents) = EvaluateStar(answer.Answer);
        answer.StarScore = starScore;
        answer.StarComponentsDetected = starComponents;

        var signals = new List<int>();

        if (answer.EyeContactPct.HasValue)
            signals.Add(Math.Clamp(answer.EyeContactPct.Value, 0, 100));

        if (!string.IsNullOrWhiteSpace(answer.DominantEmotion))
        {
            var emotionConfidence = answer.DominantEmotion.ToLowerInvariant() switch
            {
                "confident" => 95,
                "happy" => 80,
                "neutral" => 65,
                "surprised" => 55,
                "distracted" => 35,
                "nervous" => 30,
                "sad" => 25,
                "angry" => 20,
                _ => 50
            };
            signals.Add(emotionConfidence);
        }

        if (answer.SpeechWpm.HasValue)
        {
            // 110-170 wpm is the comfortable, confident delivery band already
            // used elsewhere in this service (InterviewReportSettings).
            var wpm = answer.SpeechWpm.Value;
            var wpmScore = wpm <= 0 ? 0 : wpm switch
            {
                < 80 => 40,
                < 110 => 65,
                <= 170 => 95,
                < 200 => 70,
                _ => 45
            };
            signals.Add(wpmScore);
        }

        if (signals.Count > 0)
            answer.ConfidenceScore = (int)Math.Round(signals.Average());

        var qualitySignals = new List<int>();
        if (answer.ConfidenceScore.HasValue) qualitySignals.Add(answer.ConfidenceScore.Value);

        var wordCount = (answer.Answer ?? string.Empty)
            .Split(' ', StringSplitOptions.RemoveEmptyEntries).Length;
        var lengthScore = wordCount switch
        {
            0 => 0,
            < 15 => 35,
            < 40 => 65,
            < 100 => 90,
            _ => 100
        };
        qualitySignals.Add(lengthScore);

        if (answer.FillerWordCount.HasValue && wordCount > 0)
        {
            var fillerRatio = (decimal)answer.FillerWordCount.Value * 100m / wordCount;
            var fillerScore = fillerRatio <= 3m ? 100 : (int)Math.Max(0, 100 - (fillerRatio - 3m) * 10);
            qualitySignals.Add(fillerScore);
        }

        if (qualitySignals.Count > 0)
            answer.QualityScore = (int)Math.Round(qualitySignals.Average());
    }

    public async Task<bool> UpdateAsync(
        Guid id,
        UpdateInterviewAnswerRequest request,
        Guid? scopeCompanyId,
        Guid? scopeCandidateUserId)
    {
        var answer = await _context.InterviewAnswers.FindAsync(id);

        if (answer == null)
            return false;

        if (scopeCompanyId.HasValue || scopeCandidateUserId.HasValue)
        {
            var inScopeQuery = _context.InterviewAnswers
                .AsNoTracking()
                .Where(x => x.Id == id);
            if (scopeCompanyId.HasValue)
                inScopeQuery = inScopeQuery.Where(x => x.InterviewSession.JobApplication.Job.CompanyId == scopeCompanyId.Value);
            if (scopeCandidateUserId.HasValue)
                inScopeQuery = inScopeQuery.Where(x => x.InterviewSession.JobApplication.Candidate.UserId == scopeCandidateUserId.Value);

            if (!await inScopeQuery.AnyAsync())
                return false;
        }

        answer.Question = request.Question;
        answer.Answer = request.Answer;
        answer.Order = request.Order;

        await ApplyAnalyticsAsync(answer, request.TimeSpentSec, request.EyeContactPct, request.DominantEmotion,
            request.SpeechWpm, request.FillerWordCount, request.LongestPauseSec);

        await _context.SaveChangesAsync();

        return true;
    }

    public async Task<bool> DeleteAsync(Guid id, Guid? scopeCompanyId, Guid? scopeCandidateUserId)
    {
        var answer = await _context.InterviewAnswers.FindAsync(id);

        if (answer == null)
            return false;

        if (scopeCompanyId.HasValue || scopeCandidateUserId.HasValue)
        {
            var inScopeQuery = _context.InterviewAnswers
                .AsNoTracking()
                .Where(x => x.Id == id);
            if (scopeCompanyId.HasValue)
                inScopeQuery = inScopeQuery.Where(x => x.InterviewSession.JobApplication.Job.CompanyId == scopeCompanyId.Value);
            if (scopeCandidateUserId.HasValue)
                inScopeQuery = inScopeQuery.Where(x => x.InterviewSession.JobApplication.Candidate.UserId == scopeCandidateUserId.Value);

            if (!await inScopeQuery.AnyAsync())
                return false;
        }

        _context.InterviewAnswers.Remove(answer);

        await _context.SaveChangesAsync();

        return true;
    }

    private static InterviewAnswerDto ToDto(
        InterviewAnswer answer)
    {
        return new InterviewAnswerDto
        {
            Id = answer.Id,
            InterviewSessionId = answer.InterviewSessionId,
            Question = answer.Question,
            Answer = answer.Answer,
            Order = answer.Order,
            TimeSpentSec = answer.TimeSpentSec,
            EyeContactPct = answer.EyeContactPct,
            DominantEmotion = answer.DominantEmotion,
            SpeechWpm = answer.SpeechWpm,
            FillerWordCount = answer.FillerWordCount,
            LongestPauseSec = answer.LongestPauseSec,
            ConfidenceScore = answer.ConfidenceScore,
            QualityScore = answer.QualityScore,
            GrammarScore = answer.GrammarScore,
            GrammarIssueCount = answer.GrammarIssueCount,
            StarScore = answer.StarScore,
            StarComponentsDetected = answer.StarComponentsDetected
        };
    }
}
