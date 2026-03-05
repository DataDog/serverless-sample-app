package com.inventory.acl.lambda;

import com.amazonaws.services.lambda.runtime.Context;
import com.amazonaws.services.lambda.runtime.RequestHandler;
import com.amazonaws.services.lambda.runtime.events.SQSBatchResponse;
import com.amazonaws.services.lambda.runtime.events.SQSEvent;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.inventory.acl.adapters.EventBridgeMessageWrapper;
import com.inventory.acl.core.ExternalEventHandler;
import com.inventory.acl.core.events.external.OrderCompletedEventV1;
import com.inventory.core.DataAccessException;
import com.inventory.core.InventoryItemNotFoundException;
import com.inventory.core.adapters.Carrier;
import com.inventory.core.adapters.DatadogTelemetry;
import com.inventory.core.utils.TraceUtils;
import datadog.trace.api.experimental.DataStreamsCheckpointer;
import io.opentelemetry.api.GlobalOpenTelemetry;
import io.opentelemetry.api.trace.*;
import jakarta.inject.Inject;
import jakarta.inject.Named;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.util.ArrayList;
import java.util.List;

@Named("handleOrderCompleted")
public class handleOrderCompletedLambda implements RequestHandler<SQSEvent, SQSBatchResponse> {
    @Inject
    ObjectMapper objectMapper;
    Logger logger = LoggerFactory.getLogger(handleOrderCompletedLambda.class);
    @Inject
    ExternalEventHandler eventHandler;

    @Override
    public SQSBatchResponse handleRequest(SQSEvent sqsEvent, Context context) {
        Tracer tracer = GlobalOpenTelemetry
                .getTracer("com.inventory.acl.lambda.handleOrderCompletedLambda");
        Span span = TraceUtils.startChildSpanFromLambdaInvoke(tracer);
        span.setAttribute("messaging.batch.message_count", sqsEvent.getRecords().size());
        span.setAttribute("messaging.operation.type", "receive");
        span.setAttribute("messaging.system", "aws_sqs");

        List<SQSBatchResponse.BatchItemFailure> batchItemFailures = new ArrayList<>();

        for (SQSEvent.SQSMessage message : sqsEvent.getRecords()) {
            Span processSpan = null;

            try {
                TypeReference<EventBridgeMessageWrapper<OrderCompletedEventV1>> typeRef = new TypeReference<EventBridgeMessageWrapper<OrderCompletedEventV1>>() {};
                EventBridgeMessageWrapper<OrderCompletedEventV1> evtWrapper = objectMapper.readValue(message.getBody(), typeRef);
                var processSpanBuilder = tracer.spanBuilder(String.format("process %s", evtWrapper.getDetailType()))
                        .setParent(io.opentelemetry.context.Context.current().with(Span.wrap(span.getSpanContext())));

                var upstreamContext = TraceUtils.extractSpanContextFromMessage(evtWrapper.getDetail(), logger);

                if (upstreamContext != null) {
                    logger.info("Adding link to upstream context: TraceId: '{}'. SpanId: '{}'", upstreamContext.getTraceId(), upstreamContext.getSpanId());
                    processSpanBuilder.addLink(upstreamContext);
                }

                processSpan = processSpanBuilder.startSpan();

                DatadogTelemetry datadog = evtWrapper.getDetail().getDatadog() != null
                        ? evtWrapper.getDetail().getDatadog() : new DatadogTelemetry();
                DataStreamsCheckpointer.get().setConsumeCheckpoint("eventbridge", evtWrapper.getDetailType(), new Carrier(datadog));
                processSpan.setAttribute("messaging.id", message.getMessageId());
                processSpan.setAttribute("messaging.operation.type", "process");
                processSpan.setAttribute("messaging.system", "aws_sqs");
                processSpan.setAttribute("order.id", evtWrapper.getDetail().getData().getOrderNumber());

                var result = this.eventHandler.handleOrderCompletedV1Event(evtWrapper.getDetail().getData());

                if (!result) {
                    batchItemFailures.add(SQSBatchResponse.BatchItemFailure.builder().withItemIdentifier(message.getMessageId()).build());
                }
            } catch (JsonProcessingException | DataAccessException | InventoryItemNotFoundException | Error exception) {
                batchItemFailures.add(SQSBatchResponse.BatchItemFailure.builder().withItemIdentifier(message.getMessageId()).build());
                logger.error("An exception occurred!", exception);
                if (processSpan != null) {
                    processSpan.recordException(exception);
                    processSpan.setStatus(io.opentelemetry.api.trace.StatusCode.ERROR);
                }
                span.recordException(exception);
            } finally {
                if (processSpan != null) {
                    processSpan.end();
                }
            }
        }

        span.end();

        return SQSBatchResponse.builder()
                .withBatchItemFailures(batchItemFailures)
                .build();
    }
}
