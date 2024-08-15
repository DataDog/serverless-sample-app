package com.product.publisher;

import com.amazonaws.services.lambda.runtime.events.SNSEvent;
import com.amazonaws.services.lambda.runtime.events.SQSBatchResponse;
import com.amazonaws.services.lambda.runtime.events.SQSEvent;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.product.publisher.core.InternalEventHandler;
import com.product.publisher.core.events.internal.ProductCreatedEvent;
import com.product.publisher.core.events.internal.ProductDeletedEvent;
import com.product.publisher.core.events.internal.ProductUpdatedEvent;
import io.opentracing.Span;
import io.opentracing.log.Fields;
import io.opentracing.tag.Tags;
import io.opentracing.util.GlobalTracer;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.context.annotation.Bean;

import java.lang.constant.Constable;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.function.Function;

@SpringBootApplication(scanBasePackages = "com.product.publisher")
public class FunctionConfiguration {
    @Autowired
    ObjectMapper objectMapper;
    Logger logger = LoggerFactory.getLogger(FunctionConfiguration.class);
    @Autowired
    InternalEventHandler eventHandler;

    public static void main(String[] args) {
        SpringApplication.run(FunctionConfiguration.class, args);
    }

    @Bean
    public Function<SQSEvent, SQSBatchResponse> handleInternalEvents() {
        return value -> {
            final Span span = GlobalTracer.get().activeSpan();
            span.setTag("messaging.batch.message_count", value.getRecords().size());
            span.setTag("messaging.operation.type", "receive");
            span.setTag("messaging.system", "aws_sqs");

            List<SQSBatchResponse.BatchItemFailure> batchItemFailures = new ArrayList<>();
            
            String productCreatedTopicArn = System.getenv("PRODUCT_CREATED_TOPIC_ARN");
            String productUpdatedTopicArn = System.getenv("PRODUCT_UPDATED_TOPIC_ARN");
            String productDeletedTopicArn = System.getenv("PRODUCT_DELETED_TOPIC_ARN");

            for (SQSEvent.SQSMessage message : value.getRecords()) {
                final Span processSpan = GlobalTracer.get().buildSpan("process").asChildOf(span).start();
                processSpan.setTag("messaging.id", message.getMessageId());
                processSpan.setTag("messaging.operation.type", "process");
                processSpan.setTag("messaging.system", "aws_sqs");
                        
                try {
                    SNSEvent.SNSRecord record = this.objectMapper.readValue(message.getBody(), SNSEvent.SNSRecord.class);

                    if (record.getSNS().getTopicArn().equals(productCreatedTopicArn)) {
                        ProductCreatedEvent evt = this.objectMapper.readValue(record.getSNS().getMessage(), ProductCreatedEvent.class);

                        this.eventHandler.handleProductCreatedEvent(evt);
                    } else if (record.getSNS().getTopicArn().equals(productUpdatedTopicArn)) {
                        ProductUpdatedEvent evt = this.objectMapper.readValue(record.getSNS().getMessage(), ProductUpdatedEvent.class);

                        this.eventHandler.handleProductUpdatedEvent(evt);
                    } else if (record.getSNS().getTopicArn().equals(productDeletedTopicArn)) {
                        ProductDeletedEvent evt = this.objectMapper.readValue(record.getSNS().getMessage(), ProductDeletedEvent.class);

                        this.eventHandler.handleProductDeletedEvent(evt);
                    } else {
                        this.logger.warn(String.format("Unknown topic ARN %s", record.getSNS().getTopicArn()));
                        span.setTag(Tags.ERROR, true);
                        span.setTag("error.message", String.format("Unknown topic ARN %s", record.getSNS().getTopicArn()));
                    }
                } catch (JsonProcessingException | Error exception) {
                    batchItemFailures.add(SQSBatchResponse.BatchItemFailure.builder().withItemIdentifier(message.getMessageId()).build());
                    logger.error("An exception occurred!", exception);
                    span.setTag(Tags.ERROR, true);
                    span.log(Collections.singletonMap(Fields.ERROR_OBJECT, exception));
                }
                finally {
                    processSpan.finish();
                }
            }

            return SQSBatchResponse.builder()
                    .withBatchItemFailures(batchItemFailures)
                    .build();
        };
    }
}
