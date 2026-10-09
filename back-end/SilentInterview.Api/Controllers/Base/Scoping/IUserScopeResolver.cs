using Microsoft.AspNetCore.Mvc;

namespace SilentInterview.Api.Controllers.Base.Scoping;

/// <summary>
/// Resolves the authenticated user's multi-tenant access scope from <see cref="ControllerBase.User"/>.
/// Extracted from the identical GetScopeAsync() implementations previously duplicated across
/// AIInterviewController, InterviewAnswerController, ReportController, CandidateController,
/// InterviewSessionController, and JobApplicationController.
/// </summary>
public interface IUserScopeResolver
{
    /// <summary>
    /// SuperAdmins: unrestricted (CompanyId = null, CandidateUserId = null).
    /// Candidates: scoped to their own user id (CandidateUserId = userId).
    /// Recruiters: scoped to their own company (CompanyId = recruiter's CompanyId).
    /// Returns ScopeInfo.Failed(...) if the caller cannot be identified, or if a Recruiter
    /// has no matching Recruiter profile row.
    /// </summary>
    Task<ScopeInfo> GetScopeAsync(ControllerBase controller);

    /// <summary>
    /// Company-scoped variant used by CompanyController/RecruiterController, where there is no
    /// per-candidate scope: SuperAdmins unrestricted, Recruiters scoped to their own company,
    /// everyone else (including Candidates) unrestricted read access (endpoints that need to
    /// block Candidates from writing enforce that separately via [Authorize(Roles = ...)]).
    /// </summary>
    Task<ScopeInfo> GetCompanyScopeAsync(ControllerBase controller);
}
