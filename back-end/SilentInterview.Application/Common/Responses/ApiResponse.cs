namespace SilentInterview.Application.Common.Responses;

public class ApiResponse<T>
{
    public bool Success { get; set; }

    public string Message { get; set; } = string.Empty;

    public int StatusCode { get; set; }

    public T? Data { get; set; }

    public List<string>? Errors { get; set; }

    public DateTime Timestamp { get; set; } = DateTime.UtcNow;
}