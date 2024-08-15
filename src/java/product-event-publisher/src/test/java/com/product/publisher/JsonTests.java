package com.product.publisher;

import com.amazonaws.services.lambda.runtime.events.SNSEvent;
import com.amazonaws.services.lambda.runtime.events.SQSEvent;
import com.fasterxml.jackson.core.JsonProcessingException;

import com.fasterxml.jackson.databind.DeserializationFeature;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;

import java.io.IOException;
import java.nio.charset.Charset;
import java.nio.file.Files;
import java.nio.file.Path;

import static org.junit.jupiter.api.Assertions.assertEquals;

//public class JsonTests {
//    @Test
//    public void testInputEventSerialization() throws JsonProcessingException, IOException {
//        var objectMapper = new ObjectMapper().configure(DeserializationFeature.FAIL_ON_UNKNOWN_PROPERTIES, false);
//
//        var eventSample = Files.readString(Path.of("src/test/data/sample-event.json"), Charset.defaultCharset());
//
//        SQSEvent.SQSMessage message = objectMapper.readValue(eventSample, SQSEvent.SQSMessage.class);
//        SNSEvent.SNSRecord record = objectMapper.readValue(message.getBody(), SNSEvent.SNSRecord.class);
//        
//        assertEquals(record.getSNS().getTopicArn(), "arn:aws:sns:eu-west-1:214365161190:ProductCreated-dev");
//    }
//}
