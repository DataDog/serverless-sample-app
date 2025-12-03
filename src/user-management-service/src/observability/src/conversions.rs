//
// Unless explicitly stated otherwise all files in this repository are licensed
// under the Apache License Version 2.0.
// This product includes software developed at Datadog (https://www.datadoghq.com/).
// Copyright 2024 Datadog, Inc.
//
use aws_lambda_events::cloudwatch_events::CloudWatchEvent;
use aws_lambda_events::sns::{SnsMessage, SnsRecord};
use aws_lambda_events::sqs::SqsMessage;
use lambda_http::tracing::log::info;
use serde::{Serialize, de::DeserializeOwned};
use std::convert::From;
use std::time::{Duration, SystemTime, UNIX_EPOCH};

use crate::cloud_event::CloudEvent;
use crate::spans::event_bridge::generate_inflight_span_for_event_bridge;
use crate::spans::sns::{generate_inflight_span_for_sns, generate_inflight_span_for_sns_message};
use crate::spans::sqs::generate_inflight_span_for_sqs;

impl<T> From<&SnsRecord> for CloudEvent<T>
where
    T: DeserializeOwned + Serialize,
{
    fn from(value: &SnsRecord) -> Self {
        let mut traced_message: CloudEvent<T> =
            serde_json::from_str(value.sns.message.as_str()).unwrap();

        traced_message.generate_span_context();
        generate_inflight_span_for_sns(&mut traced_message, value);

        traced_message
    }
}

impl<T> From<SnsMessage> for CloudEvent<T>
where
    T: DeserializeOwned + Serialize,
{
    fn from(value: SnsMessage) -> Self {
        let mut traced_message: CloudEvent<T> =
            serde_json::from_str(value.message.as_str()).unwrap();

        traced_message.generate_span_context();

        traced_message
    }
}

impl<T> From<SnsRecord> for CloudEvent<T>
where
    T: DeserializeOwned + Serialize,
{
    fn from(value: SnsRecord) -> Self {
        let mut traced_message: CloudEvent<T> =
            serde_json::from_str(value.sns.message.as_str()).unwrap();

        traced_message.generate_span_context();
        generate_inflight_span_for_sns(&mut traced_message, &value);

        traced_message
    }
}

impl<T> From<CloudWatchEvent> for CloudEvent<T>
where
    T: DeserializeOwned + Serialize,
{
    fn from(value: CloudWatchEvent) -> Self {
        // Use result with proper error handling instead of unwrap
        let detail = value
            .detail
            .clone()
            .ok_or("Missing detail in CloudWatchEvent")
            .unwrap();
        let mut traced_message: CloudEvent<T> = serde_json::from_value(detail).unwrap();

        traced_message.generate_span_context();
        generate_inflight_span_for_event_bridge(&mut traced_message, &value, None);

        traced_message
    }
}

impl<T> From<&SqsMessage> for CloudEvent<T>
where
    T: DeserializeOwned + Serialize,
{
    fn from(value: &SqsMessage) -> Self {
        let sent_timestamp = value.attributes.get_key_value("SentTimestamp");

        let timestamp = match sent_timestamp {
            Some((_key, val)) => match val.parse::<u64>() {
                Ok(epoch_timestamp) => UNIX_EPOCH + Duration::from_millis(epoch_timestamp),
                Err(_) => SystemTime::now(),
            },
            None => SystemTime::now(),
        };

        let json_value = CloudEvent::<T>::check_body_for_upstream_message(value);

        match json_value {
            Some(json) => {
                if json.get("TopicArn").is_some() {
                    // Handle SNS message
                    info!("Generating span for SNS message");
                    let sns_message: SnsMessage = serde_json::from_value(json).unwrap();
                    let mut cloud_event: CloudEvent<T> =
                        serde_json::from_str(&sns_message.message).unwrap();
                    cloud_event.generate_span_context();
                    generate_inflight_span_for_sns_message(
                        &mut cloud_event,
                        &sns_message,
                        Some(timestamp),
                    );
                    cloud_event
                } else if json.get("detail").is_some() {
                    // Handle EventBridge event
                    info!("Generating span for EventBridge event");
                    let event: CloudWatchEvent = serde_json::from_value(json).unwrap();
                    let detail = event.clone().detail.unwrap();
                    let mut cloud_event: CloudEvent<T> = serde_json::from_value(detail).unwrap();
                    cloud_event.generate_span_context();
                    generate_inflight_span_for_event_bridge(
                        &mut cloud_event,
                        &event,
                        Some(timestamp),
                    );
                    cloud_event.message_type = Some(event.detail_type.unwrap_or_default());
                    cloud_event
                } else {
                    panic!("Unexpected JSON structure");
                }
            }
            None => {
                // Handle direct CloudEvent parsing
                match &value.body {
                    None => panic!("No body found for SQS message"),
                    Some(body) => {
                        info!("Generating raw SQS message span");

                        let mut cloud_event: CloudEvent<T> = serde_json::from_str(body).unwrap();
                        cloud_event.generate_span_context();
                        generate_inflight_span_for_sqs(&mut cloud_event, value, timestamp);
                        cloud_event
                    }
                }
            }
        }
    }
}
