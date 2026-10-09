namespace SilentInterview.Domain.Entities;

/// <summary>
/// Stable application roles. Numeric values are persisted in SQL Server.
/// 1 = Candidate, 2 = Recruiter, 3 = SuperAdmin.
/// </summary>
public enum Role
{
    Candidate = 1,
    Recruiter = 2,
    SuperAdmin = 3
}
