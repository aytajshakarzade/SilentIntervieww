using FluentValidation;
using SilentInterview.Application.DTOs.Candidate;

namespace SilentInterview.Application.Validators.Candidate;

public class CreateCandidateRequestValidator : AbstractValidator<CreateCandidateRequest>
{
    public CreateCandidateRequestValidator()
    {
        RuleFor(x => x.UserId)
            .NotEmpty();

        RuleFor(x => x.ResumeUrl)
            .NotEmpty();

        RuleFor(x => x.Skills)
            .NotEmpty();

        RuleFor(x => x.Education)
            .NotEmpty();

        RuleFor(x => x.Experience)
            .NotEmpty();
    }
}