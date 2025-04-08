//
// Unless explicitly stated otherwise all files in this repository are licensed
// under the Apache License Version 2.0.
// This product includes software developed at Datadog (https://www.datadoghq.com/).
// Copyright 2024 Datadog, Inc.
//
use aws_lambda_events::sqs::SqsMessage;
use opentelemetry::trace::{Link, TraceContextExt};
use opentelemetry::trace::{SpanContext, SpanId, TraceFlags, TraceId, TraceState};
use opentelemetry::Context;
use serde::{de::DeserializeOwned, Deserialize, Serialize};
use std::env;
use std::time::{SystemTime, UNIX_EPOCH};
use tracing::{self, info};
use tracing_opentelemetry::OpenTelemetrySpanExt;
use uuid::Uuid;

/// Represents a Cloud Event with distributed tracing capabilities
///
/// This structure implements the CloudEvents specification while adding
/// OpenTelemetry tracing context propagation.
#[derive(Debug, Serialize, Deserialize)]
pub struct CloudEvent<T> {
    #[serde(rename = "specversion")]
    pub spec_version: String,
    pub id: String,
    pub source: String,
    #[serde(rename = "type")]
    pub message_type: Option<String>,
    pub time: String,
    pub datacontenttype: String,
    #[serde(rename = "traceparent")]
    pub trace_parent: Option<String>,
    pub data: Option<T>,
    #[serde(skip_serializing, skip_deserializing)]
    pub(crate) remote_span_context: Option<SpanContext>,
    #[serde(skip_serializing, skip_deserializing)]
    pub(crate) remote_context: Option<Context>,
}

impl<T> CloudEvent<T>
where
    T: DeserializeOwned + Serialize,
{
    /// Create a new CloudEvent with the current tracing context
    ///
    /// This captures the current OpenTelemetry context to propagate tracing information.
    pub fn new(message: T, message_type: String) -> Self
    where
        T: DeserializeOwned + Serialize + Clone,
    {
        // Access the current span
        let current_span = tracing::Span::current();
        // Retrieve the context from the current span
        let context = current_span.context();
        // Use OpenTelemetry's API to retrieve the TraceContext
        let span_context = context.span().span_context().clone();
        let start = SystemTime::now();
        let since_the_epoch = start
            .duration_since(UNIX_EPOCH)
            .expect("Time went backwards");
        let env = env::var("ENV").unwrap_or("dev".to_string());

        // Check if the span context is valid
        if span_context.is_valid() {
            // Retrieve traceId and spanId
            let trace_id = span_context.trace_id().to_string().clone();
            let span_id = span_context.span_id().to_string().clone();
            Self {
                spec_version: "1.0".to_string(),
                source: format!("{}.users", env),
                trace_parent: Some(format!("00-{}-{}-01", &trace_id, &span_id)),
                message_type: Some(message_type),
                data: Some(message.clone()),
                time: since_the_epoch.as_millis().to_string(),
                id: Uuid::new_v4().to_string(),
                datacontenttype: "application/json".to_string(),
                remote_context: None,
                remote_span_context: None,
            }
        } else {
            // No valid span context found
            Self {
                spec_version: "1.0".to_string(),
                source: format!("{}.users", env),
                message_type: Some(message_type),
                data: Some(message.clone()),
                time: since_the_epoch.as_millis().to_string(),
                id: Uuid::new_v4().to_string(),
                datacontenttype: "application/json".to_string(),
                trace_parent: None,
                remote_context: None,
                remote_span_context: None,
            }
        }
    }

    pub fn check_body_for_upstream_message(record: &SqsMessage) -> Option<serde_json::Value> {
        // Get the body, returning None if not present
        let body = record.body.as_ref()?;

        // Parse the body as JSON, logging and returning None if it fails
        let body_json = match serde_json::from_str::<serde_json::Value>(body) {
            Ok(json) => json,
            Err(_) => {
                info!("SQS message body is not valid json");
                return None;
            }
        };

        // Check if the JSON is an object, returning None if not
        let json_object = match body_json.as_object() {
            Some(obj) => obj,
            None => {
                info!("Body cannot be parsed as valid json object");
                return None;
            }
        };

        // Check if it's an SNS message
        if json_object.contains_key("TopicArn") && json_object.contains_key("Timestamp") {
            // Return the raw JSON for SNS message
            return Some(body_json);
        }

        // Check if it's a CloudWatch event
        if json_object.contains_key("detail") {
            // Return the raw JSON for CloudWatch event
            return Some(body_json);
        }

        // Not a recognized upstream message format
        None
    }

    /// Generate a span context from the trace_id and span_id fields
    pub(crate) fn generate_span_context(&mut self) {
        match &self.trace_parent {
            Some(trace_parent) => {
                info!("Generating span context from trace_parent: {}", trace_parent);

                let trace_parts: Vec<&str> = trace_parent.split("-").collect();

                if trace_parts.len() < 4 {
                    self.remote_context = None;
                    self.remote_span_context = None;
                    return;
                }

                let trace_id = TraceId::from_hex(trace_parts[1]);

                match trace_id {
                    Ok(trace_id) => {
                        let span_id = SpanId::from_hex(trace_parts[2])
                            .unwrap_or_else(|_| SpanId::from_bytes([0u8; 8]));

                        let span_context = SpanContext::new(
                            trace_id,
                            span_id,
                            TraceFlags::SAMPLED,
                            false,
                            TraceState::NONE,
                        );

                        self.remote_span_context = Some(span_context.clone());
                        self.remote_context =
                            Some(Context::new().with_remote_span_context(span_context.clone()));
                    }
                    Err(_) => {
                        self.remote_span_context = None;
                        self.remote_context = None;
                    }
                }
            }
            None => {
                info!("No trace_parent found, skipping remote span context generation");
                self.remote_span_context = None;
                self.remote_context = None;
            }
        };
    }

    /// Update the current tracing context with the provided context
    pub(crate) fn generate_span_link(&mut self) -> Option<Link> {
        match std::env::var("USE_SPAN_LINK") {
            Ok(use_links) => match use_links.as_str() {
                "true" => {
                    let linked_span_context = &self.remote_span_context;
                    match linked_span_context {
                        Some(span_ctx) => {
                            info!("Generating span link");
                            Some(Link::new(span_ctx.clone(), vec![], 0))
                        }
                        None => {
                            info!("No span link found, defaulting parenting to inflight");
                            None
                        }
                    }
                }
                _ => None,
            },
            Err(_) => None,
        }
    }
}
