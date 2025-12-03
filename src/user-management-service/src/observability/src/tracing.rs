//
// Unless explicitly stated otherwise all files in this repository are licensed
// under the Apache License Version 2.0.
// This product includes software developed at Datadog (https://www.datadoghq.com/).
// Copyright 2024 Datadog, Inc.
//
use lambda_http::{lambda_runtime, Request, RequestExt};
use opentelemetry::global::BoxedSpan;
use opentelemetry::trace::TraceContextExt;
use opentelemetry::trace::{Span, SpanKind, Tracer};
use opentelemetry::{global, Context, KeyValue};
use std::env;
use tracing_opentelemetry::OpenTelemetrySpanExt;

/// Create a trace for an AWS Lambda HTTP request
///
/// This creates a span for the Lambda request and connects it to the
/// current tracing context.
pub fn trace_request(event: &Request) -> BoxedSpan {
    let current_span = tracing::Span::current();

    let tracer = global::tracer(env::var("DD_SERVICE").expect("DD_SERVICE is not set"));
    let mut handler_span = tracer
        .span_builder(String::from("aws.lambda"))
        .with_kind(SpanKind::Internal)
        .start(&tracer);

    let _ = current_span
        .set_parent(Context::new().with_remote_span_context(handler_span.span_context().clone()));

    handler_span.set_attribute(KeyValue::new("service", "aws.lambda"));
    handler_span.set_attribute(KeyValue::new("operation_name", "aws.lambda"));
    handler_span.set_attribute(KeyValue::new("init_type", "on-demand"));
    handler_span.set_attribute(KeyValue::new(
        "request_id",
        event.lambda_context().request_id,
    ));

    handler_span.set_attribute(KeyValue::new(
        "base_service",
        env::var("DD_SERVICE").unwrap(),
    ));
    handler_span.set_attribute(KeyValue::new("origin", String::from("lambda")));
    handler_span.set_attribute(KeyValue::new("type", "serverless"));
    handler_span.set_attribute(KeyValue::new(
        "function_arn",
        event.lambda_context().invoked_function_arn,
    ));
    handler_span.set_attribute(KeyValue::new(
        "function_version",
        event.lambda_context().env_config.version.clone(),
    ));

    handler_span
}

/// Create a trace for an AWS Lambda HTTP request
///
/// This creates a span for the Lambda request and connects it to the
/// current tracing context.
pub fn trace_handler(context: lambda_runtime::Context) -> BoxedSpan {
    let current_span = tracing::Span::current();

    let tracer = global::tracer(env::var("DD_SERVICE").expect("DD_SERVICE is not set"));
    let mut handler_span = tracer
        .span_builder(String::from("aws.lambda"))
        .with_kind(SpanKind::Internal)
        .start(&tracer);

    let _ = current_span
        .set_parent(Context::new().with_remote_span_context(handler_span.span_context().clone()));

    handler_span.set_attribute(KeyValue::new("service", "aws.lambda"));
    handler_span.set_attribute(KeyValue::new("operation_name", "aws.lambda"));
    handler_span.set_attribute(KeyValue::new("init_type", "on-demand"));
    handler_span.set_attribute(KeyValue::new("request_id", context.request_id));

    handler_span.set_attribute(KeyValue::new(
        "base_service",
        env::var("DD_SERVICE").unwrap(),
    ));
    handler_span.set_attribute(KeyValue::new("origin", String::from("lambda")));
    handler_span.set_attribute(KeyValue::new("type", "serverless"));
    handler_span.set_attribute(KeyValue::new("function_arn", context.invoked_function_arn));
    handler_span.set_attribute(KeyValue::new(
        "function_version",
        context.env_config.version.clone(),
    ));

    handler_span
}
