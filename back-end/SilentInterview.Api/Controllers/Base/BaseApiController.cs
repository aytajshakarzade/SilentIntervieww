using Microsoft.AspNetCore.Mvc;
using SilentInterview.Application.Common.Responses;

namespace SilentInterview.Api.Controllers.Base;

[ApiController]
[Produces("application/json")]
public abstract class BaseApiController : ControllerBase
{
    protected IActionResult Success<T>(
        T data,
        string message = "Operation completed successfully.",
        int statusCode = StatusCodes.Status200OK)
    {
        return StatusCode(
            statusCode,
            ApiResponseFactory.Success(
                data,
                message,
                statusCode));
    }

    protected IActionResult Failure(
        string message,
        int statusCode = StatusCodes.Status400BadRequest,
        List<string>? errors = null)
    {
        return StatusCode(
            statusCode,
            ApiResponseFactory.Fail<object>(
                message,
                statusCode,
                errors));
    }
}