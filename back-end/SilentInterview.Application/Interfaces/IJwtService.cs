namespace SilentInterview.Application.Interfaces;

public interface IJwtService
{
    string GenerateAccessToken(
        Guid userId,
        string fullName,
        string email,
        string role);

    string GenerateRefreshToken();

    DateTime GetRefreshTokenExpiry();
}