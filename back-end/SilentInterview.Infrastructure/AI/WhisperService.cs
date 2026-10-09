using System.Net.Http.Headers;
using System.Text.Json;

using Microsoft.Extensions.Configuration;

using SilentInterview.Application.Common.Interfaces;

namespace SilentInterview.Infrastructure.AI;

public class WhisperService : IWhisperService
{
    private readonly HttpClient _httpClient;
    private readonly IConfiguration _configuration;

    public WhisperService(
        HttpClient httpClient,
        IConfiguration configuration)
    {
        _httpClient = httpClient;
        _configuration = configuration;
        // API key validation is deferred to TranscribeAsync so that a missing
        // key does not throw during dependency-injection / application startup.
    }

    public async Task<string> TranscribeAsync(
        Stream audioStream,
        string fileName,
        string contentType,
        CancellationToken cancellationToken = default)
    {
        var apiKey = _configuration["OpenAI:ApiKey"];

        if (string.IsNullOrWhiteSpace(apiKey))
        {
            throw new InvalidOperationException(
                "Whisper transcription is unavailable: the OpenAI API key is not configured. " +
                "Please set the 'OpenAI:ApiKey' configuration value.");
        }

        var baseUrl = _configuration["OpenAI:BaseUrl"];

        if (string.IsNullOrWhiteSpace(baseUrl))
        {
            throw new InvalidOperationException(
                "Whisper transcription is unavailable: 'OpenAI:BaseUrl' is not configured.");
        }

        _httpClient.BaseAddress = new Uri(baseUrl);
        _httpClient.DefaultRequestHeaders.Authorization =
            new AuthenticationHeaderValue("Bearer", apiKey);

        using var form = new MultipartFormDataContent();

        var fileContent = new StreamContent(audioStream);

        fileContent.Headers.ContentType =
            new MediaTypeHeaderValue(contentType);

        form.Add(fileContent, "file", fileName);

        form.Add(
            new StringContent(
                _configuration["OpenAI:WhisperModel"]!),
            "model");

        var response = await _httpClient.PostAsync(
            "audio/transcriptions",
            form,
            cancellationToken);

        if (!response.IsSuccessStatusCode)
        {
            var error =
                await response.Content.ReadAsStringAsync(cancellationToken);

            throw new Exception($"OpenAI Whisper Error: {error}");
        }

        var json =
            await response.Content.ReadAsStringAsync(cancellationToken);

        using var document = JsonDocument.Parse(json);

        if (!document.RootElement.TryGetProperty("text", out var textElement))
        {
            throw new Exception("Whisper returned an invalid response.");
        }

        return textElement.GetString()!.Trim();
    }
}
