using FluentValidation;
using SilentInterview.Application.DTOs.Auth;

namespace SilentInterview.Application.Validators.Auth;

public class RegisterRequestValidator
    : AbstractValidator<RegisterRequest>
{
    public RegisterRequestValidator()
    {
        RuleFor(x => x.FullName)
            .NotEmpty()
            .MinimumLength(2)
            .MaximumLength(100);

        RuleFor(x => x.Email)
            .NotEmpty()
            .EmailAddress();

        RuleFor(x => x.Password)
            .NotEmpty()
            .WithMessage("Password is required.")
            .MinimumLength(8)
            .WithMessage("Password must be at least 8 characters long.")
            .Matches("[A-Z]")
            .WithMessage("Password must contain an uppercase letter.")
            .Matches("[a-z]")
            .WithMessage("Password must contain a lowercase letter.")
            .Matches("[0-9]")
            .WithMessage("Password must contain a number.")
            .Matches("[^A-Za-z0-9]")
            .WithMessage("Password must contain a special character.");

        RuleFor(x => x.ConfirmPassword)
            .Equal(x => x.Password)
            .WithMessage("Passwords do not match.");

        RuleFor(x => x.CompanyCountry)
            .NotEmpty()
            .When(x => string.Equals(x.Role, "Recruiter", StringComparison.OrdinalIgnoreCase))
            .WithMessage("Country is required for recruiter accounts.");

        RuleFor(x => x.CompanyName)
            .NotEmpty()
            .MinimumLength(2)
            .MaximumLength(150)
            .When(x => string.Equals(x.Role, "Recruiter", StringComparison.OrdinalIgnoreCase))
            .WithMessage("Choose your company to continue.");
    }
}