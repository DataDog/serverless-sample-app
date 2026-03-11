// Unless explicitly stated otherwise all files in this repository are licensed under the Apache License Version 2.0.
// This product includes software developed at Datadog (https://www.datadoghq.com/).
// Copyright 2026 Datadog, Inc.

using System.Diagnostics;
using System.Globalization;
using System.IO.Compression;
using System.Net.Http.Headers;
using System.Text;
using System.Text.Json;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;
using Orders.Core.Telemetry;
using Serilog;

namespace Orders.Core.Adapters;

public class DatadogTransactionTracker : ITransactionTracker
{
    private readonly string _apiKey;
    private readonly string _service;
    private readonly string _environment;
    private readonly Uri _pipelineStatsEndpoint;

    private readonly IHttpClientFactory _httpClientFactory;
    private readonly ILogger<DatadogTransactionTracker> _logger;

    public DatadogTransactionTracker(IHttpClientFactory httpClientFactory,
        IConfiguration configuration,
        ILogger<DatadogTransactionTracker> logger)
    {
        ArgumentNullException.ThrowIfNull(configuration);

        _httpClientFactory = httpClientFactory;
        _logger = logger;
        _apiKey = configuration["DD_API_KEY"] ?? string.Empty;
        _service = configuration["DD_SERVICE"] ?? "print-service";
        _environment = configuration["DD_ENV"] ?? "local";
        var ddSite = configuration["DD_SITE"] ?? "datadoghq.com";
        _pipelineStatsEndpoint = new Uri($"https://trace.agent.{ddSite}/api/v0.1/pipeline_stats");
    }

    public async Task TrackTransactionAsync(string transactionId, string checkpoint)
    {
        if (string.IsNullOrEmpty(_apiKey))
        {
            this._logger.LogInformation("DD_API_KEY is not configured. Skipping transaction tracking for transaction {TransactionId} at checkpoint {Checkpoint}.", transactionId, checkpoint);
            return;
        }

        try
        {
            if (Activity.Current is not null)
            {
                Activity.Current.SetTag("dsm.transaction.id", transactionId);
                Activity.Current.SetTag("dsm.transaction.checkpoint", checkpoint);
            }

            var timestampNanos = (DateTimeOffset.UtcNow.ToUnixTimeMilliseconds() * 1_000_000L)
                .ToString(CultureInfo.InvariantCulture);

            var payload = new
            {
                transactions = new[]
                {
                    new
                    {
                        transaction_id = transactionId,
                        checkpoint,
                        timestamp_nanos = timestampNanos
                    }
                },
                service = _service,
                environment = _environment
            };

            var json = JsonSerializer.Serialize(payload);
            var compressed = Gzip(Encoding.UTF8.GetBytes(json));

            using var client = _httpClientFactory.CreateClient();
            using var request = new HttpRequestMessage(HttpMethod.Post, _pipelineStatsEndpoint);
            request.Headers.Add("DD-API-KEY", _apiKey);
            request.Content = new ByteArrayContent(compressed);
            request.Content.Headers.ContentType = new MediaTypeHeaderValue("application/json");
            request.Content.Headers.ContentEncoding.Add("gzip");

            var response = await client.SendAsync(request);
            response.EnsureSuccessStatusCode();

#pragma warning disable
            _logger.LogInformation(
                "Successfully tracked transaction {TransactionId} at checkpoint {Checkpoint} with status code {StatusCode}",
                transactionId, checkpoint, response.StatusCode);
#pragma warning enable
        }
#pragma warning disable CA1031
        catch (Exception ex)
#pragma warning restore CA1031
        {
            this._logger.LogError(ex, "Failed to track transaction {TransactionId} at checkpoint {Checkpoint}.", transactionId, checkpoint);
        }
    }

    private static byte[] Gzip(byte[] data)
    {
        using var output = new MemoryStream();
        using (var gzip = new GZipStream(output, CompressionMode.Compress))
        {
            gzip.Write(data);
        }

        return output.ToArray();
    }
}