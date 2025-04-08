//
// Unless explicitly stated otherwise all files in this repository are licensed
// under the Apache License Version 2.0.
// This product includes software developed at Datadog (https://www.datadoghq.com/).
// Copyright 2024 Datadog, Inc.
//
use aws_lambda_events::sns::{SnsMessage, SnsRecord};
use opentelemetry::trace::{Span, SpanKind, Tracer};
use opentelemetry::{global, KeyValue};
use std::env;
use std::time::{Duration, SystemTime, UNIX_EPOCH};
use tracing;
use tracing_opentelemetry::OpenTelemetrySpanExt;

use crate::cloud_event::CloudEvent;
use crate::utils::parse_name_from_arn;

/// Generate an inflight span for an SNS record
pub fn generate_inflight_span_for_sns<T>(cloud_event: &mut CloudEvent<T>, record: &SnsRecord)
where
    T: serde::de::DeserializeOwned + serde::Serialize,
{
    let topic_name = parse_name_from_arn(&record.sns.topic_arn);

    let tracer = global::tracer(topic_name.clone());

    let start_time = UNIX_EPOCH + Duration::from_millis(cloud_event.time.parse::<u64>().unwrap());

    let current_span = tracing::Span::current().context();

    let mut span_links = vec![];
    let span_link = cloud_event.generate_span_link();

    if let Some(span_link) = span_link {
        span_links.push(span_link);
    }

    let mut span = tracer
        .span_builder("aws.sns")
        .with_kind(SpanKind::Internal)
        .with_start_time(start_time)
        .with_end_time(SystemTime::now())
        .with_links(span_links)
        .start_with_context(&tracer, &current_span);

    span.set_attribute(KeyValue::new("operation_name", "aws.sns"));
    span.set_attribute(KeyValue::new("resource_names", topic_name.clone()));
    span.set_attribute(KeyValue::new("service", topic_name.clone()));
    span.set_attribute(KeyValue::new("service.name", topic_name.clone()));
    span.set_attribute(KeyValue::new("span.type", "web"));
    span.set_attribute(KeyValue::new("resource.name", topic_name.clone()));
    span.set_attribute(KeyValue::new(
        "peer.service",
        env::var("DD_SERVICE").unwrap_or_default(),
    ));
    span.set_attribute(KeyValue::new("_inferred_span.tag_source", "self"));
    span.set_attribute(KeyValue::new("_inferred_span.synchronicity", "async"));
    span.set_attribute(KeyValue::new("type", record.sns.sns_message_type.clone()));
    span.set_attribute(KeyValue::new(
        "subject",
        record.sns.subject.clone().unwrap_or_default(),
    ));
    span.set_attribute(KeyValue::new("message_id", record.sns.message_id.clone()));
    span.set_attribute(KeyValue::new("topicname", topic_name.clone()));
    span.set_attribute(KeyValue::new("topic_arn", record.sns.topic_arn.clone()));

    span.set_attribute(KeyValue::new(
        "peer.messaging.destination",
        topic_name.clone(),
    ));
    span.set_attribute(KeyValue::new(
        "event_subscription_arn",
        record.event_subscription_arn.clone(),
    ));
}

/// Generate an inflight span for an SNS message
pub fn generate_inflight_span_for_sns_message<T>(
    cloud_event: &mut CloudEvent<T>,
    record: &SnsMessage,
    sns_end_date: Option<SystemTime>,
) where
    T: serde::de::DeserializeOwned + serde::Serialize,
{
    let topic_name = parse_name_from_arn(&record.topic_arn);

    let tracer = global::tracer(topic_name.clone());

    let start_time = UNIX_EPOCH + Duration::from_millis(cloud_event.time.parse::<u64>().unwrap());

    let end_time = match sns_end_date {
        Some(end_time) => end_time,
        None => SystemTime::now(),
    };

    let current_span = tracing::Span::current().context();

    let mut span_links = vec![];
    let span_link = cloud_event.generate_span_link();

    if let Some(span_link) = span_link {
        span_links.push(span_link);
    }

    let mut span = tracer
        .span_builder("aws.sns")
        .with_kind(SpanKind::Internal)
        .with_start_time(start_time)
        .with_end_time(end_time)
        .with_links(span_links)
        .start_with_context(&tracer, &current_span);

    span.set_attribute(KeyValue::new("operation_name", "aws.sns"));
    span.set_attribute(KeyValue::new("resource_names", topic_name.clone()));
    span.set_attribute(KeyValue::new("service", topic_name.clone()));
    span.set_attribute(KeyValue::new("service.name", topic_name.clone()));
    span.set_attribute(KeyValue::new("span.type", "web"));
    span.set_attribute(KeyValue::new("resource.name", topic_name.clone()));
    span.set_attribute(KeyValue::new(
        "peer.service",
        env::var("DD_SERVICE").unwrap_or_default(),
    ));
    span.set_attribute(KeyValue::new("_inferred_span.tag_source", "self"));
    span.set_attribute(KeyValue::new("_inferred_span.synchronicity", "async"));
    span.set_attribute(KeyValue::new("type", record.sns_message_type.clone()));
    span.set_attribute(KeyValue::new(
        "subject",
        record.subject.clone().unwrap_or_default(),
    ));
    span.set_attribute(KeyValue::new("message_id", record.message_id.clone()));
    span.set_attribute(KeyValue::new("topicname", topic_name.clone()));
    span.set_attribute(KeyValue::new("topic_arn", record.topic_arn.clone()));
    span.set_attribute(KeyValue::new(
        "peer.messaging.destination",
        topic_name.clone(),
    ));
}
