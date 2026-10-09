namespace SilentInterview.Application.Common.Interfaces;

public interface IWhisperService
{
    Task<string> TranscribeAsync(
        Stream audioStream,
        string fileName,
        string contentType,
        CancellationToken cancellationToken = default);
}