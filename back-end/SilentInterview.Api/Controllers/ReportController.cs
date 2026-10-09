using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Asp.Versioning;
using SilentInterview.Api.Controllers.Base;
using SilentInterview.Api.Controllers.Base.Scoping;
using SilentInterview.Application.Common.Models;
using SilentInterview.Application.DTOs.Report;
using SilentInterview.Application.Interfaces;
using SilentInterview.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;
using System.Security.Claims;

namespace SilentInterview.Api.Controllers;

/// <summary>
/// Report Management
/// </summary>
[Authorize]
[ApiVersion("1.0")]
[Route("api/v{version:apiVersion}/[controller]")]
public class ReportController : BaseApiController
{
    private readonly IReportService _service;
    private readonly SilentInterviewDbContext _context;
    private readonly IUserScopeResolver _scopeResolver;

    public ReportController(IReportService service, SilentInterviewDbContext context, IUserScopeResolver scopeResolver)
    {
        _service = service;
        _context = context;
        _scopeResolver = scopeResolver;
    }

    /// <summary>
    /// Get all reports.
    /// Supports pagination, filtering, searching and sorting.
    /// Recruiters only see reports for interview sessions tied to their own company's jobs.
    /// Candidates only see reports for their own interview sessions.
    /// </summary>
    [HttpGet]
    [ProducesResponseType(StatusCodes.Status200OK)]
    public async Task<IActionResult> GetAll(
        [FromQuery] ReportQueryParameters parameters)
    {
        var scope = await _scopeResolver.GetScopeAsync(this);
        if (scope.IsError)
            return scope.Error!;

        var reports = await _service.GetAllAsync(parameters, scope.CompanyId, scope.CandidateUserId);

        return Success(
            reports,
            "Reports retrieved successfully.");
    }

    /// <summary>
    /// Get report by id.
    /// Candidates may only access reports for their own interview sessions;
    /// recruiters only for sessions tied to their own company's jobs.
    /// </summary>
    [HttpGet("{id:guid}")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> GetById(Guid id)
    {
        var scope = await _scopeResolver.GetScopeAsync(this);
        if (scope.IsError)
            return scope.Error!;

        var report = await _service.GetByIdAsync(id, scope.CompanyId, scope.CandidateUserId);

        if (report == null)
        {
            return Failure(
                "Report not found.",
                StatusCodes.Status404NotFound);
        }

        return Success(
            report,
            "Report retrieved successfully.");
    }

    /// <summary>
    /// Create report.
    /// </summary>
    [HttpPost]
    [Authorize(Roles = "Recruiter,SuperAdmin")]
    [ProducesResponseType(StatusCodes.Status201Created)]
    public async Task<IActionResult> Create(
        CreateReportRequest request)
    {
        var report = await _service.CreateAsync(request);

        return Success(
            report,
            "Report created successfully.",
            StatusCodes.Status201Created);
    }

    /// <summary>
    /// Generates a deterministic report from the answers already recorded for an interview.
    /// </summary>
    [HttpPost("generate/{interviewSessionId:guid}")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> Generate(Guid interviewSessionId, CancellationToken cancellationToken)
    {
        var scope = await _scopeResolver.GetScopeAsync(this);
        if (scope.IsError)
            return scope.Error!;

        try
        {
            var report = await _service.GenerateFromInterviewAsync(interviewSessionId, scope.CompanyId, scope.CandidateUserId, cancellationToken);
            return Success(report, "Interview report generated successfully.");
        }
        catch (InvalidOperationException exception) when (exception.Message == "Interview session not found.")
        {
            return Failure(exception.Message, StatusCodes.Status404NotFound);
        }
        catch (InvalidOperationException exception)
        {
            return Failure(exception.Message, StatusCodes.Status400BadRequest);
        }
    }

    /// <summary>
    /// Update report.
    /// </summary>
    [HttpPut("{id:guid}")]
    [Authorize(Roles = "Recruiter,SuperAdmin")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> Update(
        Guid id,
        UpdateReportRequest request)
    {
        var scope = await _scopeResolver.GetScopeAsync(this);
        if (scope.IsError)
            return scope.Error!;

        var updated = await _service.UpdateAsync(id, request, scope.CompanyId);

        if (!updated)
        {
            return Failure(
                "Report not found.",
                StatusCodes.Status404NotFound);
        }

        return Success(
            true,
            "Report updated successfully.");
    }

    /// <summary>
    /// Delete report.
    /// </summary>
    [HttpDelete("{id:guid}")]
    [Authorize(Roles = "Recruiter,SuperAdmin")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> Delete(Guid id)
    {
        var scope = await _scopeResolver.GetScopeAsync(this);
        if (scope.IsError)
            return scope.Error!;

        var deleted = await _service.DeleteAsync(id, scope.CompanyId);

        if (!deleted)
        {
            return Failure(
                "Report not found.",
                StatusCodes.Status404NotFound);
        }

        return Success(
            true,
            "Report deleted successfully.");
    }

}
