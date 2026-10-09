using Microsoft.AspNetCore.Mvc;
using SilentInterview.Api.Contracts.OpenAI;
using SilentInterview.Application.Common.Interfaces;
using Asp.Versioning;
namespace SilentInterview.Api.Controllers;

[ApiController]
[ApiVersion("1.0")]
[Route("api/v{version:apiVersion}/[controller]")]
public class OpenAIController : ControllerBase
{
    private readonly IWhisperService _whisperService;

    public OpenAIController(IWhisperService whisperService)
    {
        _whisperService = whisperService;
    }

    [HttpPost("transcribe")]
    public async Task<IActionResult> Transcribe(
        [FromForm] TranscribeRequest request,
        CancellationToken cancellationToken)
    {
        if (request.File == null || request.File.Length == 0)
        {
            return BadRequest(new
            {
                success = false,
                message = "Audio file is required."
            });
        }

        await using var stream = request.File.OpenReadStream();

        var transcript = await _whisperService.TranscribeAsync(
            stream,
            request.File.FileName,
            request.File.ContentType ?? "audio/webm",
            cancellationToken);

        return Ok(new
        {
            success = true,
            data = new TranscribeResponse
            {
                Transcript = transcript
            }
        });
    }
}