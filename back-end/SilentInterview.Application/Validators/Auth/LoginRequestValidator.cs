using FluentValidation;
using SilentInterview.Application.DTOs.Auth;

namespace SilentInterview.Application.Validators.Auth;

public class LoginRequestValidator
    : AbstractValidator<LoginRequest>
{
    public LoginRequestValidator()
    {
        RuleFor(x => x.Email)
            .NotEmpty()
            .EmailAddress();

        RuleFor(x => x.Password)
            .NotEmpty();
    }
}