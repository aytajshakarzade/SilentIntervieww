using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Asp.Versioning;
using SilentInterview.Api.Controllers.Base;
using SilentInterview.Api.Controllers.Base.Scoping;
using SilentInterview.Application.Common.Models;
using SilentInterview.Application.DTOs.InterviewAnswer;
using SilentInterview.Application.Interfaces;
using System.Security.Claims;
using Microsoft.EntityFrameworkCore;
using SilentInterview.Infrastructure.Persistence;

namespace SilentInterview.Api.Controllers;

/// <summary>
/// Interview Answer Management
/// </summary>
[Authorize]
[ApiVersion("1.0")]
[Route("api/v{version:apiVersion}/[controller]")]
public class InterviewAnswerController : BaseApiController
{
    private readonly IInterviewAnswerService _service;
    private readonly IInterviewTimelineService _timelineService;
    private readonly SilentInterviewDbContext _context;
    private readonly IUserScopeResolver _scopeResolver;
    private readonly IInterviewSessionAccessGuard _accessGuard;

    public InterviewAnswerController(
        IInterviewAnswerService service,
        IInterviewTimelineService timelineService,
        SilentInterviewDbContext context,
        IUserScopeResolver scopeResolver,
        IInterviewSessionAccessGuard accessGuard)
    {
        _service = service;
        _timelineService = timelineService;
        _context = context;
        _scopeResolver = scopeResolver;
        _accessGuard = accessGuard;
    }

    /// <summary>
    /// Get all interview answers.
    /// Supports pagination, filtering, searching and sorting.
    /// Recruiters only see answers for sessions tied to their own company's jobs.
    /// Candidates only see their own answers.
    /// </summary>
    [HttpGet]
    [ProducesResponseType(StatusCodes.Status200OK)]
    public async Task<IActionResult> GetAll(
        [FromQuery] InterviewAnswerQueryParameters parameters)
    {
        var scope = await _scopeResolver.GetScopeAsync(this);
        if (scope.IsError)
            return scope.Error!;

        var answers = await _service.GetAllAsync(parameters, scope.CompanyId, scope.CandidateUserId);

        return Success(
            answers,
            "Interview answers retrieved successfully.");
    }

    /// <summary>
    /// Get interview answer by id.
    /// </summary>
    [HttpGet("{id:guid}")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> GetById(Guid id)
    {
        var scope = await _scopeResolver.GetScopeAsync(this);
        if (scope.IsError)
            return scope.Error!;

        var answer = await _service.GetByIdAsync(id, scope.CompanyId, scope.CandidateUserId);

        if (answer == null)
        {
            return Failure(
                "Interview answer not found.",
                StatusCodes.Status404NotFound);
        }

        return Success(
            answer,
            "Interview answer retrieved successfully.");
    }

    /// <summary>
    /// Create interview answer.
    /// </summary>
    [HttpPost]
    [ProducesResponseType(StatusCodes.Status201Created)]
    public async Task<IActionResult> Create(
        CreateInterviewAnswerRequest request)
    {
        if (!Guid.TryParse(User.FindFirstValue(ClaimTypes.NameIdentifier), out var userId))
            return Failure("Authenticated user could not be identified.", StatusCodes.Status401Unauthorized);
        if (!await _accessGuard.CanAccessAsync(this, request.InterviewSessionId, userId))
            return Failure("Interview session not found.", StatusCodes.Status404NotFound);

        var answer = await _service.CreateAsync(request);
        Guid? actorId = Guid.TryParse(User.FindFirstValue(ClaimTypes.NameIdentifier), out var parsedUserId) ? parsedUserId : null;
        await _timelineService.RecordAsync(
            answer.InterviewSessionId,
            actorId,
            "AnswerSaved",
            $"Answer {answer.Order} was saved.");

        return Success(
            answer,
            "Interview answer created successfully.",
            StatusCodes.Status201Created);
    }

    /// <summary>
    /// Update interview answer.
    /// </summary>
    [HttpPut("{id:guid}")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> Update(
        Guid id,
        UpdateInterviewAnswerRequest request)
    {
        var scope = await _scopeResolver.GetScopeAsync(this);
        if (scope.IsError)
            return scope.Error!;

        var updated = await _service.UpdateAsync(id, request, scope.CompanyId, scope.CandidateUserId);

        if (!updated)
        {
            return Failure(
                "Interview answer not found.",
                StatusCodes.Status404NotFound);
        }

        return Success(
            true,
            "Interview answer updated successfully.");
    }

    /// <summary>
    /// Delete interview answer.
    /// </summary>
    [HttpDelete("{id:guid}")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> Delete(Guid id)
    {
        var scope = await _scopeResolver.GetScopeAsync(this);
        if (scope.IsError)
            return scope.Error!;

        var deleted = await _service.DeleteAsync(id, scope.CompanyId, scope.CandidateUserId);

        if (!deleted)
        {
            return Failure(
                "Interview answer not found.",
                StatusCodes.Status404NotFound);
        }

        return Success(
            true,
            "Interview answer deleted successfully.");
    }


}
