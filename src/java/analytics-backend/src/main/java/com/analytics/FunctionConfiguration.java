package com.analytics;

import com.amazonaws.services.lambda.runtime.events.*;
import com.analytics.adapters.EventBridgeMessageWrapper;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;

import com.timgroup.statsd.StatsDClient;
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

import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.function.Function;

@SpringBootApplication(scanBasePackages = "com.analytics")
public class FunctionConfiguration {
    @Autowired
    ObjectMapper objectMapper;
    
    @Autowired
    StatsDClient statsDClient;
    
    Logger logger = LoggerFactory.getLogger(FunctionConfiguration.class);

    public static void main(String[] args) {
        SpringApplication.run(FunctionConfiguration.class, args);
    }

    @Bean
    public Function<SQSEvent, SQSBatchResponse> handleEvents() {
        return value -> {
            final Span span = GlobalTracer.get().activeSpan();
            span.setTag("messaging.batch.message_count", value.getRecords().size());
            span.setTag("messaging.operation.type", "receive");
            span.setTag("messaging.system", "aws_sqs");

            List<SQSBatchResponse.BatchItemFailure> batchItemFailures = new ArrayList<>();
            
            for (SQSEvent.SQSMessage message : value.getRecords()) {
                final Span processSpan = GlobalTracer.get().buildSpan("process").asChildOf(span).start();

                processSpan.setTag("messaging.id", message.getMessageId());
                processSpan.setTag("messaging.operation.type", "process");
                processSpan.setTag("messaging.system", "aws_sqs");
                        
                try {
                    EventBridgeMessageWrapper evtWrapper = objectMapper.readValue(message.getBody(), EventBridgeMessageWrapper.class);
                    
                    this.logger.info(String.format("TraceId = %s", evtWrapper.getTraceData().getTraceId()));
                    this.logger.info(String.format("SpanId = %s", evtWrapper.getTraceData().getSpanId()));
                    
                    this.statsDClient.incrementCounter(evtWrapper.getDetailType());
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
