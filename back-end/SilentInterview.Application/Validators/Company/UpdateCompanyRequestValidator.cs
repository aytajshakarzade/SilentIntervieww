using FluentValidation;
using SilentInterview.Application.DTOs.Company;

namespace SilentInterview.Application.Validators.Company;

public class UpdateCompanyRequestValidator : AbstractValidator<UpdateCompanyRequest>
{
    public UpdateCompanyRequestValidator()
    {
        RuleFor(x => x.Name)
            .NotEmpty()
            .MinimumLength(2);

        RuleFor(x => x.Description)
            .NotEmpty();

        RuleFor(x => x.Website)
            .NotEmpty();
    }
}