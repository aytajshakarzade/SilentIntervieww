using Microsoft.AspNetCore.Http;

namespace SilentInterview.Api.Contracts.OpenAI;

public class TranscribeRequest
{
    public IFormFile File { get; set; } = default!;
}