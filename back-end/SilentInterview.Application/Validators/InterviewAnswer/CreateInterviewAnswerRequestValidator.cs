using FluentValidation;
using SilentInterview.Application.DTOs.InterviewAnswer;

namespace SilentInterview.Application.Validators.InterviewAnswer;

public class CreateInterviewAnswerRequestValidator
    : AbstractValidator<CreateInterviewAnswerRequest>
{
    public CreateInterviewAnswerRequestValidator()
    {
        RuleFor(x => x.InterviewSessionId)
            .NotEmpty();

        RuleFor(x => x.Question)
            .NotEmpty();

        RuleFor(x => x.Answer)
            .NotEmpty();

        RuleFor(x => x.Order)
            .GreaterThan(0);
    }
}