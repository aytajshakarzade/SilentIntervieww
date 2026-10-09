using FluentValidation;
using SilentInterview.Application.DTOs.Report;

namespace SilentInterview.Application.Validators.Report;

public class CreateReportRequestValidator
    : AbstractValidator<CreateReportRequest>
{
    public CreateReportRequestValidator()
    {
        RuleFor(x => x.InterviewSessionId)
            .NotEmpty();

        RuleFor(x => x.Score)
            .InclusiveBetween(0, 100);

        RuleFor(x => x.Feedback)
            .NotEmpty();
    }
}