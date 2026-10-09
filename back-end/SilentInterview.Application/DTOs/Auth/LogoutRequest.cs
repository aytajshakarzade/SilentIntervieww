namespace SilentInterview.Application.DTOs.Auth;

public class LogoutRequest
{
    public string RefreshToken { get; set; } = string.Empty;
}