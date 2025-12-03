//
// Unless explicitly stated otherwise all files in this repository are licensed
// under the Apache License Version 2.0.
// This product includes software developed at Datadog (https://www.datadoghq.com/).
// Copyright 2024 Datadog, Inc.
//

use aws_lambda_events::cloudwatch_events::CloudWatchEvent;
use opentelemetry::trace::{Span, SpanKind, Tracer};
use opentelemetry::{KeyValue, global};
use std::env;
use std::time::SystemTime;
use tracing_opentelemetry::OpenTelemetrySpanExt;

use crate::cloud_event::CloudEvent;

/// Generate an inflight span for an EventBridge event
pub fn generate_inflight_span_for_event_bridge<T>(
    cloud_event: &mut CloudEvent<T>,
    record: &CloudWatchEvent,
    sqs_start_time: Option<SystemTime>,
) where
    T: serde::de::DeserializeOwned + serde::Serialize,
{
    let bus_name = record
        .source
        .clone()
        .unwrap_or("aws.eventbridge".to_string());

    let tracer = global::tracer(bus_name.clone());

    let end_time = match sqs_start_time {
        Some(end_time) => end_time,
        None => SystemTime::now(),
    };

    let current_span = tracing::Span::current().context();

    let mut span_links = vec![];
    let span_link = cloud_event.generate_span_link();

    if let Some(span_link) = span_link {
        span_links.push(span_link);
    }

    let mut span: global::BoxedSpan = tracer
        .span_builder(
            record
                .source
                .clone()
                .unwrap_or("aws.eventbridge".to_string()),
        )
        .with_kind(SpanKind::Internal)
        .with_start_time(record.time)
        .with_end_time(end_time)
        .with_links(span_links)
        .start_with_context(&tracer, &current_span);

    if cloud_event.remote_span_context.is_some() {
        span.add_link(cloud_event.remote_span_context.clone().unwrap(), vec![]);
    }

    span.set_attribute(KeyValue::new("operation_name", "aws.eventbrdidge"));
    span.set_attribute(KeyValue::new("resource_names", bus_name.clone()));
    span.set_attribute(KeyValue::new("service", bus_name.clone()));
    span.set_attribute(KeyValue::new("service.name", bus_name.clone()));
    span.set_attribute(KeyValue::new("span.type", "web"));
    span.set_attribute(KeyValue::new("resource.name", bus_name.clone()));
    span.set_attribute(KeyValue::new(
        "peer.service",
        env::var("DD_SERVICE").unwrap_or_default(),
    ));
    span.set_attribute(KeyValue::new("_inferred_span.tag_source", "self"));
    span.set_attribute(KeyValue::new("_inferred_span.synchronicity", "async"));

    span.set_attribute(KeyValue::new(
        "peer.messaging.destination",
        bus_name.clone(),
    ));
}
