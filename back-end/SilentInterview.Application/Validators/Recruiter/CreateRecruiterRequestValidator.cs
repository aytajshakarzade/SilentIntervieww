using FluentValidation;
using SilentInterview.Application.DTOs.Recruiter;

namespace SilentInterview.Application.Validators.Recruiter;

public class CreateRecruiterRequestValidator : AbstractValidator<CreateRecruiterRequest>
{
    public CreateRecruiterRequestValidator()
    {
        RuleFor(x => x.UserId)
            .NotEmpty();

        RuleFor(x => x.CompanyId)
            .NotEmpty();
    }
}