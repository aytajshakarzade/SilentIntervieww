using System.Net;
using System.Text.Json;
using SilentInterview.Application.Common.Exceptions;
using SilentInterview.Application.Common.Responses;

namespace SilentInterview.Api.Middleware;

public sealed class ExceptionMiddleware(RequestDelegate next, ILogger<ExceptionMiddleware> logger)
{
    public async Task InvokeAsync(HttpContext context)
    {
        try
        {
            await next(context);
        }
        catch (Exception exception)
        {
            logger.LogError(exception, "Unhandled request failure");

            context.Response.ContentType = "application/json";
            context.Response.StatusCode = exception switch
            {
                BadRequestException or InvalidOperationException => (int)HttpStatusCode.BadRequest,
                UnauthorizedException => (int)HttpStatusCode.Unauthorized,
                NotFoundException => (int)HttpStatusCode.NotFound,
                ConflictException => (int)HttpStatusCode.Conflict,
                _ => (int)HttpStatusCode.InternalServerError
            };

            var userMessage = exception switch
            {
                BadRequestException => exception.Message,
                UnauthorizedException => exception.Message,
                NotFoundException => exception.Message,
                ConflictException => exception.Message,
                InvalidOperationException => exception.Message,
                _ => "An unexpected error occurred. Please try again later."
            };

            await context.Response.WriteAsync(JsonSerializer.Serialize(new
            {
                Success = false,
                StatusCode = context.Response.StatusCode,
                Message = userMessage
            }));
        }
    }
}
