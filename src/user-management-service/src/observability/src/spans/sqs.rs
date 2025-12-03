//
// Unless explicitly stated otherwise all files in this repository are licensed
// under the Apache License Version 2.0.
// This product includes software developed at Datadog (https://www.datadoghq.com/).
// Copyright 2024 Datadog, Inc.
//
use aws_lambda_events::sqs::SqsMessage;
use opentelemetry::trace::{Span, SpanKind, Tracer};
use opentelemetry::{KeyValue, global};
use std::env;
use std::time::SystemTime;
use tracing_opentelemetry::OpenTelemetrySpanExt;

use crate::cloud_event::CloudEvent;
use crate::utils::parse_name_from_arn;

/// Generate an inflight span for an SQS message
pub fn generate_inflight_span_for_sqs<T>(
    cloud_event: &mut CloudEvent<T>,
    record: &SqsMessage,
    timestamp: SystemTime,
) -> SystemTime
where
    T: serde::de::DeserializeOwned + serde::Serialize,
{
    let event_source_arn = record
        .event_source_arn
        .clone()
        .unwrap_or("unknown_arn".to_string());

    let queue_name = parse_name_from_arn(&event_source_arn);

    let tracer = global::tracer(queue_name.clone());

    let mut span_links = vec![];
    let span_link = cloud_event.generate_span_link();

    if let Some(span_link) = span_link {
        span_links.push(span_link.clone());
    }

    let current_span = tracing::Span::current().context();

    let mut span = tracer
        .span_builder("aws.sqs")
        .with_kind(SpanKind::Internal)
        .with_start_time(timestamp)
        .with_end_time(SystemTime::now())
        .with_links(span_links)
        .start_with_context(&tracer, &current_span);

    span.set_attribute(KeyValue::new("operation_name", "aws.sqs"));
    span.set_attribute(KeyValue::new("resource_names", queue_name.clone()));
    span.set_attribute(KeyValue::new("service", queue_name.clone()));
    span.set_attribute(KeyValue::new("service.name", queue_name.clone()));
    span.set_attribute(KeyValue::new("span.type", "web"));
    span.set_attribute(KeyValue::new("resource.name", queue_name.clone()));
    span.set_attribute(KeyValue::new(
        "peer.service",
        env::var("DD_SERVICE").unwrap_or("unknown_service".to_string()),
    ));
    span.set_attribute(KeyValue::new("_inferred_span.tag_source", "self"));
    span.set_attribute(KeyValue::new("_inferred_span.synchronicity", "async"));
    span.set_attribute(KeyValue::new("queuename", queue_name.clone()));
    span.set_attribute(KeyValue::new(
        "event_source_arn",
        record.event_source_arn.clone().unwrap_or_default(),
    ));
    span.set_attribute(KeyValue::new(
        "receipt_handle",
        record.receipt_handle.clone().unwrap_or_default(),
    ));

    if let Some((_key, val)) = record.attributes.get_key_value("ApproximateReceiveCount") {
        span.set_attribute(KeyValue::new("retry_count", val.clone()))
    }
    if let Some((_key, val)) = record.attributes.get_key_value("SenderId") {
        span.set_attribute(KeyValue::new("sender_id", val.clone()))
    }

    timestamp
}
