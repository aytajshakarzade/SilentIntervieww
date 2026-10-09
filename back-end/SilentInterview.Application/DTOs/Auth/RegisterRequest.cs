namespace SilentInterview.Application.DTOs.Auth;

public class RegisterRequest
{
    public string FullName { get; set; } = string.Empty;

    public string Email { get; set; } = string.Empty;

    public string Password { get; set; } = string.Empty;

    public string ConfirmPassword { get; set; } = string.Empty;

    public string Role { get; set; } = "Candidate";

    // Recruiter workspace is selected during account creation; there is no
    // separate "Add Company" flow inside the dashboard.
    public Guid? CompanyId { get; set; }
    public string? CompanyName { get; set; }
    public string? CompanyCountry { get; set; }
    public string? CompanyIndustry { get; set; }
    public string? CompanyWebsite { get; set; }
}