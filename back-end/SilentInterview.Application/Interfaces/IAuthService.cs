using SilentInterview.Application.DTOs.Auth;

namespace SilentInterview.Application.Interfaces;

public interface IAuthService
{
    Task<bool> RegisterAsync(RegisterRequest request);

    Task<AuthResponse?> LoginAsync(LoginRequest request);

    Task<AuthResponse?> RefreshTokenAsync(
        RefreshTokenRequest request);

    Task<bool> LogoutAsync(Guid userId,
        LogoutRequest request);
}
