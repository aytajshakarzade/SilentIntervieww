using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

using SilentInterview.Api.Controllers.Base;
using SilentInterview.Api.Controllers.Base.Scoping;
using SilentInterview.Application.Common.Models;
using SilentInterview.Application.DTOs.Candidate;
using SilentInterview.Application.Interfaces;
using SilentInterview.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;
using System.Security.Claims;
using Asp.Versioning;

namespace SilentInterview.Api.Controllers;

/// <summary>
/// Candidate Management
/// </summary>
[Authorize]
[ApiVersion("1.0")]
[Route("api/v{version:apiVersion}/[controller]")]
public class CandidateController : BaseApiController
{
    private readonly ICandidateService _candidateService;
    private readonly SilentInterviewDbContext _context;
    private readonly IUserScopeResolver _scopeResolver;

    public CandidateController(ICandidateService candidateService, SilentInterviewDbContext context, IUserScopeResolver scopeResolver)
    {
        _candidateService = candidateService;
        _context = context;
        _scopeResolver = scopeResolver;
    }

    /// <summary>
    /// Get all candidates
    /// Supports pagination, search, filtering and sorting.
    /// Recruiters only see candidates who applied to their own company's jobs.
    /// </summary>
    [HttpGet]
    [ProducesResponseType(StatusCodes.Status200OK)]
    public async Task<IActionResult> GetAll(
        [FromQuery] CandidateQueryParameters parameters)
    {
        var scope = await _scopeResolver.GetScopeAsync(this);
        if (scope.IsError)
            return scope.Error!;

        var candidates = await _candidateService.GetAllAsync(parameters, scope.CompanyId, scope.CandidateUserId);

        return Success(
            candidates,
            "Candidates retrieved successfully.");
    }

    /// <summary>
    /// Get candidate by id
    /// </summary>
    [HttpGet("{id:guid}")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> GetById(Guid id)
    {
        var scope = await _scopeResolver.GetScopeAsync(this);
        if (scope.IsError)
            return scope.Error!;

        var candidate = await _candidateService.GetByIdAsync(id, scope.CompanyId, scope.CandidateUserId);

        if (candidate == null)
        {
            return Failure(
                "Candidate not found.",
                StatusCodes.Status404NotFound);
        }

        return Success(
            candidate,
            "Candidate retrieved successfully.");
    }

    /// <summary>
    /// Create candidate
    /// </summary>
    [HttpPost]
    [ProducesResponseType(StatusCodes.Status201Created)]
    public async Task<IActionResult> Create(
        CreateCandidateRequest request)
    {
        if (!Guid.TryParse(User.FindFirstValue(ClaimTypes.NameIdentifier), out var userId))
            return Failure("Authenticated user could not be identified.", StatusCodes.Status401Unauthorized);

        if (User.IsInRole("Candidate"))
        {
            // Candidates may only create their own profile, never on behalf of another user.
            request.UserId = userId;
        }

        var candidate = await _candidateService.CreateAsync(request);

        return Success(
            candidate,
            "Candidate created successfully.",
            StatusCodes.Status201Created);
    }

    /// <summary>
    /// Update candidate
    /// </summary>
    [HttpPut("{id:guid}")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> Update(
        Guid id,
        UpdateCandidateRequest request)
    {
        var scope = await _scopeResolver.GetScopeAsync(this);
        if (scope.IsError)
            return scope.Error!;

        var updated = await _candidateService.UpdateAsync(id, request, scope.CompanyId, scope.CandidateUserId);

        if (!updated)
        {
            return Failure(
                "Candidate not found.",
                StatusCodes.Status404NotFound);
        }

        return Success(
            true,
            "Candidate updated successfully.");
    }

    /// <summary>
    /// Delete candidate
    /// </summary>
    [HttpDelete("{id:guid}")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> Delete(Guid id)
    {
        var scope = await _scopeResolver.GetScopeAsync(this);
        if (scope.IsError)
            return scope.Error!;

        var deleted = await _candidateService.DeleteAsync(id, scope.CompanyId, scope.CandidateUserId);

        if (!deleted)
        {
            return Failure(
                "Candidate not found.",
                StatusCodes.Status404NotFound);
        }

        return Success(
            true,
            "Candidate deleted successfully.");
    }

    /// <summary>
    /// Restore a soft-deleted candidate.
    /// </summary>
    [HttpPut("{id:guid}/restore")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> Restore(Guid id)
    {
        var scope = await _scopeResolver.GetScopeAsync(this);
        if (scope.IsError)
            return scope.Error!;

        var restored = await _candidateService.RestoreAsync(id, scope.CompanyId, scope.CandidateUserId);

        if (!restored)
        {
            return Failure(
                "Candidate not found.",
                StatusCodes.Status404NotFound);
        }

        return Success(
            true,
            "Candidate restored successfully.");
    }

}
