namespace SilentInterview.Application.Common.Responses;

public static class ApiResponseFactory
{
    public static ApiResponse<T> Success<T>(
        T data,
        string message = "Operation completed successfully.",
        int statusCode = 200)
    {
        return new ApiResponse<T>
        {
            Success = true,
            Message = message,
            StatusCode = statusCode,
            Data = data
        };
    }

    public static ApiResponse<T> Fail<T>(
        string message,
        int statusCode = 400,
        List<string>? errors = null)
    {
        return new ApiResponse<T>
        {
            Success = false,
            Message = message,
            StatusCode = statusCode,
            Errors = errors
        };
    }
}