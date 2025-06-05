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
import com.inventory.acl.core.events.external.OrderCreatedEventV1;
import com.inventory.core.DataAccessException;
import com.inventory.core.InventoryItemNotFoundException;
import com.inventory.core.adapters.Carrier;
import datadog.trace.api.experimental.DataStreamsCheckpointer;
import io.opentracing.Scope;
import io.opentracing.Span;
import io.opentracing.log.Fields;
import io.opentracing.tag.Tags;
import io.opentracing.util.GlobalTracer;
import jakarta.inject.Inject;
import jakarta.inject.Named;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.util.ArrayList;
import java.util.Collections;
import java.util.List;

@Named("handleOrderCreated")
public class handleOrderCreatedLambda implements RequestHandler<SQSEvent, SQSBatchResponse> {
    @Inject
    ObjectMapper objectMapper;
    Logger logger = LoggerFactory.getLogger(handleOrderCreatedLambda.class);
    @Inject
    ExternalEventHandler eventHandler;

    @Override
    public SQSBatchResponse handleRequest(SQSEvent sqsEvent, Context context) {
        final Span span = GlobalTracer.get().activeSpan();
        span.setTag("messaging.batch.message_count", sqsEvent.getRecords().size());
        span.setTag("messaging.operation.type", "receive");
        span.setTag("messaging.system", "aws_sqs");

        List<SQSBatchResponse.BatchItemFailure> batchItemFailures = new ArrayList<>();

        for (SQSEvent.SQSMessage message : sqsEvent.getRecords()) {
            try {
                TypeReference<EventBridgeMessageWrapper<OrderCreatedEventV1>> typeRef = new TypeReference<EventBridgeMessageWrapper<OrderCreatedEventV1>>() {};
                EventBridgeMessageWrapper<OrderCreatedEventV1> evtWrapper = objectMapper.readValue(message.getBody(), typeRef);

                final Span processSpan = GlobalTracer.get()
                        .buildSpan(String.format("process %s", evtWrapper.getDetailType()))
                        .asChildOf(span)
                        .start();

                try (Scope scope = GlobalTracer.get().activateSpan(processSpan)) {
                    var carrier = new Carrier();
                    DataStreamsCheckpointer.get().setConsumeCheckpoint("sns", evtWrapper.getDetail().getType(), carrier);
                    processSpan.setTag("messaging.id", message.getMessageId());
                    processSpan.setTag("messaging.operation.type", "process");
                    processSpan.setTag("messaging.system", "aws_sqs");
                    processSpan.setTag("order.id", evtWrapper.getDetail().getData().getOrderNumber());
                    processSpan.setTag("conversationId", evtWrapper.getDetail().getConversationId());
                    processSpan.setTag("order.productCount", evtWrapper.getDetail().getData().getProducts().size());

                    var result = this.eventHandler.handleOrderCreatedV1Event(evtWrapper.getDetail().getData(), evtWrapper.getDetail().getConversationId());

                    if (!result) {
                        batchItemFailures.add(SQSBatchResponse.BatchItemFailure.builder().withItemIdentifier(message.getMessageId()).build());
                    }
                }

                processSpan.finish();
            } catch (JsonProcessingException | DataAccessException | InventoryItemNotFoundException | Error exception) {
                batchItemFailures.add(SQSBatchResponse.BatchItemFailure.builder().withItemIdentifier(message.getMessageId()).build());
                logger.error("An exception occurred!", exception);
                span.setTag(Tags.ERROR, true);
                span.log(Collections.singletonMap(Fields.ERROR_OBJECT, exception));
            } finally {
                span.finish();
            }
        }

        return SQSBatchResponse.builder()
                .withBatchItemFailures(batchItemFailures)
                .build();
    }
}
