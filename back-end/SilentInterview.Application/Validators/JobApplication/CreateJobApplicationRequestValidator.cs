using FluentValidation;
using SilentInterview.Application.DTOs.JobApplication;

namespace SilentInterview.Application.Validators.JobApplication;

public class CreateJobApplicationRequestValidator
    : AbstractValidator<CreateJobApplicationRequest>
{
    public CreateJobApplicationRequestValidator()
    {
        RuleFor(x => x.CandidateId)
            .NotEmpty();

        RuleFor(x => x.JobId)
            .NotEmpty();
    }
}