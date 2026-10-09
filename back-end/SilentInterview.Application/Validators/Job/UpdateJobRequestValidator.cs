using FluentValidation;
using SilentInterview.Application.DTOs.Job;

namespace SilentInterview.Application.Validators.Job;

public class UpdateJobRequestValidator : AbstractValidator<UpdateJobRequest>
{
    public UpdateJobRequestValidator()
    {
        RuleFor(x => x.Title)
            .NotEmpty()
            .MinimumLength(3);

        RuleFor(x => x.Description)
            .NotEmpty();

        RuleFor(x => x.Requirements)
            .NotEmpty();

        RuleFor(x => x.Salary)
            .GreaterThan(0);

        RuleFor(x => x.CompanyId)
            .NotEmpty();

        // Phase 3A — interview configuration (all optional)
        RuleFor(x => x.Experience)
            .MaximumLength(50);

        RuleFor(x => x.Skills)
            .MaximumLength(2000);

        RuleFor(x => x.Difficulty)
            .MaximumLength(50);

        RuleFor(x => x.Language)
            .MaximumLength(10);

        RuleFor(x => x.EstimatedDuration)
            .GreaterThan(0)
            .When(x => x.EstimatedDuration.HasValue);

        RuleFor(x => x.Culture)
            .MaximumLength(2000);
    }
}