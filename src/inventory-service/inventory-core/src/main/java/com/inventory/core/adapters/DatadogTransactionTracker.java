/*
 * Unless explicitly stated otherwise all files in this repository are licensed under the Apache License Version 2.0.
 * This product includes software developed at Datadog (https://www.datadoghq.com/).
 * Copyright 2024 Datadog, Inc.
 */

package com.inventory.core.adapters;

import com.fasterxml.jackson.annotation.JsonProperty;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.inventory.core.TransactionTracker;
import com.inventory.core.config.AppConfig;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.io.ByteArrayOutputStream;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.util.List;
import java.util.zip.GZIPOutputStream;

@ApplicationScoped
public class DatadogTransactionTracker implements TransactionTracker {

    private static final Logger logger = LoggerFactory.getLogger(DatadogTransactionTracker.class);
    private static final Duration REQUEST_TIMEOUT = Duration.ofSeconds(5);

    private final HttpClient httpClient;
    private final ObjectMapper objectMapper;
    private final AppConfig appConfig;

    @Inject
    public DatadogTransactionTracker(AppConfig appConfig) {
        this.appConfig = appConfig;
        this.objectMapper = new ObjectMapper();
        this.httpClient = HttpClient.newBuilder()
                .connectTimeout(REQUEST_TIMEOUT)
                .build();
    }

    @Override
    public void track(String transactionId, String checkpoint) {
        String apiKey = appConfig.getDdApiKey();
        if (apiKey == null || apiKey.isBlank()) {
            logger.debug("DD_API_KEY not configured, skipping transaction tracking");
            return;
        }

        String url = String.format("https://trace.agent.%s/api/v0.1/pipeline_stats", appConfig.getDdSite());
        long timestampNanos = System.currentTimeMillis() * 1_000_000L;

        var transaction = new Transaction(transactionId, checkpoint, String.valueOf(timestampNanos));
        var payload = new Payload(List.of(transaction), appConfig.getDdService(), appConfig.getEnvironment());

        try {
            byte[] jsonBytes = objectMapper.writeValueAsBytes(payload);
            int statusCode = sendCompressed(jsonBytes, url, apiKey);

            if (statusCode != 202) {
                logger.warn("Datadog pipeline_stats returned unexpected status: {}", statusCode);
            }
        } catch (Exception e) {
            logger.error("Failed to send transaction tracking event for transactionId={}, checkpoint={}", transactionId, checkpoint, e);
        }
    }

    /**
     * Gzip-compresses {@code jsonBytes} and POSTs the result to {@code url}.
     *
     * <p>Required headers:
     * <ul>
     *   <li>{@code Content-Type: application/json}</li>
     *   <li>{@code Content-Encoding: gzip}</li>
     *   <li>{@code DD-API-KEY: <apiKey>}</li>
     * </ul>
     *
     * @return the HTTP response status code
     */
    private int sendCompressed(byte[] jsonBytes, String url, String apiKey) throws Exception {
        var buffer = new ByteArrayOutputStream();
        try (var gzip = new GZIPOutputStream(buffer)) {
            gzip.write(jsonBytes);
        }
        byte[] compressed = buffer.toByteArray();

        var request = HttpRequest.newBuilder(URI.create(url))
                .header("Content-Type", "application/json")
                .header("Content-Encoding", "gzip")
                .header("DD-API-KEY", apiKey)
                .timeout(REQUEST_TIMEOUT)
                .POST(HttpRequest.BodyPublishers.ofByteArray(compressed))
                .build();

        HttpResponse<String> response = httpClient.send(request, HttpResponse.BodyHandlers.ofString());
        return response.statusCode();
    }

    // ---------------------------------------------------------------------------
    // Payload records
    // ---------------------------------------------------------------------------

    record Transaction(
            @JsonProperty("transaction_id") String transactionId,
            @JsonProperty("checkpoint")      String checkpoint,
            @JsonProperty("timestamp_nanos") String timestampNanos
    ) {}

    record Payload(
            @JsonProperty("transactions") List<Transaction> transactions,
            @JsonProperty("service")      String service,
            @JsonProperty("environment")  String environment
    ) {}
}
