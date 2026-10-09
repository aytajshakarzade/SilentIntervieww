using Microsoft.AspNetCore.Mvc;

namespace SilentInterview.Api.Controllers.Base;

/// <summary>
/// Result of resolving the authenticated user's multi-tenant scope.
/// If <see cref="Error"/> is non-null, the caller should return it immediately.
/// Otherwise <see cref="CompanyId"/> / <see cref="CandidateUserId"/> hold the resolved scope (null means unrestricted/not applicable).
/// </summary>
public sealed class ScopeInfo
{
    public Guid? CompanyId { get; init; }
    public Guid? CandidateUserId { get; init; }
    public IActionResult? Error { get; init; }

    public bool IsError => Error is not null;

    public static ScopeInfo Failed(IActionResult error) => new() { Error = error };

    public static ScopeInfo Ok(Guid? companyId = null, Guid? candidateUserId = null) =>
        new() { CompanyId = companyId, CandidateUserId = candidateUserId };
}
