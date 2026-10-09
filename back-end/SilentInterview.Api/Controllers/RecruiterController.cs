using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Asp.Versioning;
using SilentInterview.Api.Controllers.Base;
using SilentInterview.Api.Controllers.Base.Scoping;
using SilentInterview.Application.Common.Models;
using SilentInterview.Application.DTOs.Recruiter;
using SilentInterview.Application.Interfaces;
using SilentInterview.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;
using System.Security.Claims;

namespace SilentInterview.Api.Controllers;

/// <summary>
/// Recruiter Management
/// </summary>
[Authorize]
[ApiVersion("1.0")]
[Route("api/v{version:apiVersion}/[controller]")]
public class RecruiterController : BaseApiController
{
    private readonly IRecruiterService _recruiterService;
    private readonly SilentInterviewDbContext _context;
    private readonly IUserScopeResolver _scopeResolver;

    public RecruiterController(IRecruiterService recruiterService, SilentInterviewDbContext context, IUserScopeResolver scopeResolver)
    {
        _recruiterService = recruiterService;
        _context = context;
        _scopeResolver = scopeResolver;
    }

    /// <summary>
    /// Get all recruiters.
    /// Supports pagination, filtering and sorting.
    /// Recruiters only see recruiters within their own company.
    /// </summary>
    [HttpGet]
    [Authorize(Roles = "Recruiter")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    public async Task<IActionResult> GetAll(
        [FromQuery] RecruiterQueryParameters parameters)
    {
        var scope = await _scopeResolver.GetCompanyScopeAsync(this);
        if (scope.IsError)
            return scope.Error!;

        var recruiters = await _recruiterService.GetAllAsync(parameters, scope.CompanyId);

        return Success(
            recruiters,
            "Recruiters retrieved successfully.");
    }

    /// <summary>
    /// Get recruiter by id.
    /// </summary>
    [HttpGet("{id:guid}")]
    [Authorize(Roles = "Recruiter")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> GetById(Guid id)
    {
        var scope = await _scopeResolver.GetCompanyScopeAsync(this);
        if (scope.IsError)
            return scope.Error!;

        var recruiter = await _recruiterService.GetByIdAsync(id, scope.CompanyId);

        if (recruiter == null)
        {
            return Failure(
                "Recruiter not found.",
                StatusCodes.Status404NotFound);
        }

        return Success(
            recruiter,
            "Recruiter retrieved successfully.");
    }

    /// <summary>
    /// Create recruiter.
    /// </summary>
    [HttpPost]
    [Authorize(Roles = "Recruiter")]
    [ProducesResponseType(StatusCodes.Status201Created)]
    public async Task<IActionResult> Create(
        CreateRecruiterRequest request)
    {
        var recruiter = await _recruiterService.CreateAsync(request);

        return Success(
            recruiter,
            "Recruiter created successfully.",
            StatusCodes.Status201Created);
    }

    /// <summary>
    /// Update recruiter.
    /// </summary>
    [HttpPut("{id:guid}")]
    [Authorize(Roles = "Recruiter")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> Update(
        Guid id,
        UpdateRecruiterRequest request)
    {
        var updated = await _recruiterService.UpdateAsync(id, request, null);

        if (!updated)
        {
            return Failure(
                "Recruiter not found.",
                StatusCodes.Status404NotFound);
        }

        return Success(
            true,
            "Recruiter updated successfully.");
    }

    /// <summary>
    /// Delete recruiter.
    /// </summary>
    [HttpDelete("{id:guid}")]
    [Authorize(Roles = "Recruiter")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> Delete(Guid id)
    {
        var deleted = await _recruiterService.DeleteAsync(id, null);

        if (!deleted)
        {
            return Failure(
                "Recruiter not found.",
                StatusCodes.Status404NotFound);
        }

        return Success(
            true,
            "Recruiter deleted successfully.");
    }

    /// <summary>
    /// Restore a soft-deleted recruiter.
    /// </summary>
    [HttpPut("{id:guid}/restore")]
    [Authorize(Roles = "Recruiter")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> Restore(Guid id)
    {
        var restored = await _recruiterService.RestoreAsync(id, null);

        if (!restored)
        {
            return Failure(
                "Recruiter not found.",
                StatusCodes.Status404NotFound);
        }

        return Success(
            true,
            "Recruiter restored successfully.");
    }

}