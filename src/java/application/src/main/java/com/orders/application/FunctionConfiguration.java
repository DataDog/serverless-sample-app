package com.orders.application;

import com.amazonaws.services.dynamodbv2.AmazonDynamoDB;
import com.amazonaws.services.dynamodbv2.AmazonDynamoDBAsyncClientBuilder;
import com.amazonaws.services.dynamodbv2.model.AttributeValue;
import com.amazonaws.services.dynamodbv2.model.GetItemRequest;
import com.amazonaws.services.dynamodbv2.model.GetItemResult;
import com.amazonaws.services.dynamodbv2.model.PutItemRequest;
import com.amazonaws.services.eventbridge.AmazonEventBridge;
import com.amazonaws.services.eventbridge.AmazonEventBridgeClientBuilder;
import com.amazonaws.services.eventbridge.model.PutEventsRequest;
import com.amazonaws.services.eventbridge.model.PutEventsRequestEntry;
import com.amazonaws.services.lambda.runtime.events.*;
import com.amazonaws.services.sns.AmazonSNS;
import com.amazonaws.services.sns.AmazonSNSClientBuilder;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.DeserializationFeature;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.orders.application.core.Order;
import com.orders.application.core.OrderConfirmedEvent;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.context.annotation.Bean;

import java.io.UncheckedIOException;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.function.Function;

@SpringBootApplication(scanBasePackages = "com.orders.application")
public class FunctionConfiguration {
    final AmazonDynamoDB dynamoDB = AmazonDynamoDBAsyncClientBuilder.defaultClient();
    final AmazonSNS snsClient = AmazonSNSClientBuilder.defaultClient();
    final AmazonEventBridge eventBridgeClient = AmazonEventBridgeClientBuilder.defaultClient();
    final String eventSource = String.format("%s.orders", System.getenv("ENV"));
    final ObjectMapper objectMapper = new ObjectMapper().configure(DeserializationFeature.FAIL_ON_UNKNOWN_PROPERTIES, false);
    private static final Logger logger = LoggerFactory.getLogger(FunctionConfiguration.class);

    public static void main(String[] args) {
        SpringApplication.run(FunctionConfiguration.class, args);
    }

    @Bean
    public Function<APIGatewayV2HTTPEvent, APIGatewayV2HTTPResponse> handleGetOrder() {
        return value -> {
            if (!value.getPathParameters().containsKey("orderId")) {
                return APIGatewayV2HTTPResponse.builder()
                        .withStatusCode(400)
                        .withBody("{}")
                        .withHeaders(Map.of("Content-Type", "application/json"))
                        .build();
            }

            String orderId = value.getPathParameters().get("orderId");

            GetItemRequest request = new GetItemRequest()
                    .withTableName(System.getenv("TABLE_NAME"))
                    .addKeyEntry("PK", new AttributeValue(orderId));

            GetItemResult result = dynamoDB.getItem(request);

            Map<String, AttributeValue> item = result.getItem();

            if (item == null) {
                return APIGatewayV2HTTPResponse.builder()
                        .withStatusCode(404)
                        .withBody("{}")
                        .withHeaders(Map.of("Content-Type", "application/json"))
                        .build();
            }

            Order order = new Order(item.get("PK").getS());

            // Business logic goes here.
            try {
                return APIGatewayV2HTTPResponse.builder()
                        .withStatusCode(200)
                        .withBody(this.objectMapper.writeValueAsString(order))
                        .withHeaders(Map.of("Content-Type", "application/json"))
                        .build();
            } catch (JsonProcessingException e) {
                logger.error("an exception occurred", e);

                return APIGatewayV2HTTPResponse.builder()
                        .withStatusCode(500)
                        .withBody("{}")
                        .withHeaders(Map.of("Content-Type", "application/json"))
                        .build();
            }
        };
    }

    @Bean
    public Function<APIGatewayV2HTTPEvent, APIGatewayV2HTTPResponse> handleCreateOrder() {
        return value -> {
            if (value.getBody() == null) {
                return APIGatewayV2HTTPResponse.builder()
                        .withStatusCode(400)
                        .withBody("{}")
                        .withHeaders(Map.of("Content-Type", "application/json"))
                        .build();
            }

            try {
                Order order = this.objectMapper.readValue(value.getBody(), Order.class);

                HashMap<String, AttributeValue> item =
                        new HashMap<>();
                item.put("PK", new AttributeValue(order.getOrderId()));

                PutItemRequest putItemRequest = new PutItemRequest()
                        .withTableName(System.getenv("TABLE_NAME"))
                        .withItem(item);

                this.dynamoDB.putItem(putItemRequest);

                OrderConfirmedEvent evt = new OrderConfirmedEvent(order.getOrderId());

                snsClient.publish(System.getenv("SNS_TOPIC_ARN"), this.objectMapper.writeValueAsString(evt));

                return APIGatewayV2HTTPResponse.builder()
                        .withStatusCode(201)
                        .withBody("{}")
                        .withHeaders(Map.of("Content-Type", "application/json"))
                        .build();

            } catch (JsonProcessingException e) {
                logger.error("an exception occurred", e);

                return APIGatewayV2HTTPResponse.builder()
                        .withStatusCode(500)
                        .withBody("{}")
                        .withHeaders(Map.of("Content-Type", "application/json"))
                        .build();
            }
        };
    }

    @Bean
    public Function<SNSEvent, String> handleSnsMessage() {
        return snsEvent -> {
            for (SNSEvent.SNSRecord record : snsEvent.getRecords()) {
                logger.info(record.getSNS().getMessage());
            }

            return "OK";
        };
    }

    @Bean
    public Function<SQSEvent, SQSBatchResponse> handleSnsToSqsMessage() {
        return sqsEvent -> {
            List<SQSBatchResponse.BatchItemFailure> batchItemFailureList = new ArrayList<>();

            for (SQSEvent.SQSMessage message : sqsEvent.getRecords()) {
                try {
                    SnsMessageWrapper snsWrapper = this.objectMapper.readValue(message.getBody(), SnsMessageWrapper.class);

                    OrderConfirmedEvent evt = this.objectMapper.readValue(snsWrapper.getMessage(), OrderConfirmedEvent.class);

                    logger.info(String.format("Processing message for order '%s'", evt.getOrderId()));

                    PutEventsRequestEntry ebEventEntry = new PutEventsRequestEntry()
                            .withEventBusName(System.getenv("EVENT_BUS_NAME"))
                            .withSource(eventSource)
                            .withDetail(this.objectMapper.writeValueAsString(evt))
                            .withDetailType("order.orderConfirmed");

                    logger.info(String.format("Publishing '%s' to '%s' with a source of '%s'", ebEventEntry.getDetail(), ebEventEntry.getEventBusName(), ebEventEntry.getSource()));

                    eventBridgeClient.putEvents(new PutEventsRequest()
                            .withEntries(List.of(ebEventEntry)));

                } catch (JsonProcessingException e) {
                    logger.error("Failure processing SQS message", e);

                    batchItemFailureList.add(new SQSBatchResponse.BatchItemFailure(message.getMessageId()));
                }
            }

            return SQSBatchResponse.builder()
                    .withBatchItemFailures(batchItemFailureList)
                    .build();
        };
    }

    @Bean
    public Function<ScheduledEvent, String> handleEventBridgeEvent() {
        return evt -> {
            try {
                var jsonData = this.objectMapper.writerWithDefaultPrettyPrinter().writeValueAsString(evt.getDetail());
                
                logger.info(String.format("Json data is %s", jsonData));
                
                var orderConfirmedEventEventBridgeMessageWrapper = this.objectMapper.readValue(jsonData, OrderConfirmedEvent.class);
                
                logger.info(String.format("Processing %s for from $s", evt.getDetailType(), evt.getSource()));

                logger.info(orderConfirmedEventEventBridgeMessageWrapper.getOrderId());
                return "OK";
            } catch (JsonProcessingException ex) {
                throw new UncheckedIOException(ex);
            }
        };
    }

    @Bean
    public Function<SQSEvent, SQSBatchResponse> handleEventBridgeToSqsEvent() {
        return sqsEvent -> {
            List<SQSBatchResponse.BatchItemFailure> batchItemFailureList = new ArrayList<>();

            for (SQSEvent.SQSMessage message : sqsEvent.getRecords()) {
                try {
                    TypeReference<EventBridgeMessageWrapper<OrderConfirmedEvent>> typeRef = new TypeReference<>() {
                    };
                    EventBridgeMessageWrapper<OrderConfirmedEvent> evt = this.objectMapper.readValue(message.getBody(), typeRef);

                    logger.info(String.format("Processing message for order '%s'", evt.getDetail().getOrderId()));

                } catch (JsonProcessingException e) {
                    logger.error("Failure processing SQS message", e);

                    batchItemFailureList.add(new SQSBatchResponse.BatchItemFailure(message.getMessageId()));
                }
            }

            return SQSBatchResponse.builder()
                    .withBatchItemFailures(batchItemFailureList)
                    .build();
        };
    }
}
