use opentelemetry_datadog::new_pipeline;
use std::env;
use std::time::{Duration, SystemTime, UNIX_EPOCH};
use aws_lambda_events::sns::SnsRecord;
use opentelemetry::{global, Context, KeyValue};
use opentelemetry::trace::{Span, SpanContext, SpanId, SpanKind, TraceContextExt, TraceFlags, TraceId, TraceState, Tracer};
use tracing::{Subscriber};
use tracing_subscriber::{layer::SubscriberExt, Registry};
use tracing_opentelemetry::OpenTelemetrySpanExt;
use serde::{Deserialize, Serialize};

pub fn observability() -> impl Subscriber + Send + Sync
{
    let tracer = new_pipeline()
        .with_service_name(env::var("DD_SERVICE").expect("DD_SERVICE is not set"))
        .with_agent_endpoint("http://127.0.0.1:8126")
        .with_api_version(opentelemetry_datadog::ApiVersion::Version05)
        .with_trace_config(
            opentelemetry_sdk::trace::config()
                .with_sampler(opentelemetry_sdk::trace::Sampler::AlwaysOn)
                .with_id_generator(opentelemetry_sdk::trace::RandomIdGenerator::default()),
        )
        .install_simple()
        .unwrap();

    let telemetry_layer = tracing_opentelemetry::layer().with_tracer(tracer);
    let logger = tracing_subscriber::fmt::layer().json().flatten_event(true);
    let fmt_layer = tracing_subscriber::fmt::layer()
        .with_target(false)
        .without_time();

    let layer = Registry::default()
        .with(fmt_layer)
        .with(telemetry_layer)
        .with(logger)
        .with(tracing_subscriber::EnvFilter::from_default_env());

    layer
}

#[derive(Deserialize, Serialize)]
pub struct TracedMessage {
    trace_id: String,
    span_id: String,
    pub message: String,
    publish_time: String,
    #[serde(skip_serializing, skip_deserializing)]
    ctx: Option<Context>,
}

impl TracedMessage {
    pub fn new<T>(message: T) -> Self
    where
        T: Serialize,
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

        // Check if the span context is valid
        if span_context.is_valid() {
            // Retrieve traceId and spanId
            let trace_id = span_context.trace_id().to_string().clone();
            let span_id = span_context.span_id().to_string().clone();
            Self {
                trace_id,
                span_id,
                message: serde_json::to_string(&message).unwrap(),
                publish_time: since_the_epoch.as_millis().to_string(),
                ctx: None
            }
        } else {
            // No valid span context found
            Self {
                trace_id: "".to_string(),
                span_id: "".to_string(),
                message: serde_json::to_string(&message).unwrap(),
                publish_time: since_the_epoch.as_millis().to_string(),
                ctx: None
            }
        }
    }
}

impl From<&SnsRecord> for TracedMessage {
    fn from(value: &SnsRecord) -> Self {
        let mut traced_message: TracedMessage = serde_json::from_str(value.sns.message.as_str()).unwrap();

        let trace_id = TraceId::from_hex(traced_message.trace_id.as_str()).unwrap();
        let span_id = SpanId::from_hex(traced_message.span_id.as_str()).unwrap();

        let span_context = SpanContext::new(
            trace_id,
            span_id,
            TraceFlags::SAMPLED,
            false,
            TraceState::NONE,
        );

        traced_message.ctx = Some(Context::new().with_remote_span_context(span_context.clone())); 
        tracing::Span::current().set_parent(traced_message.ctx.clone().unwrap());
        
        traced_message.generate_inflight_span_for(value);
        
        traced_message
    }
}

impl TracedMessage {
    fn generate_inflight_span_for(&self, record: &SnsRecord) {
        let current_context = match &self.ctx{
            None => &tracing::Span::current().context(),
            Some(ctx) => ctx
        };
        
        let tracer = global::tracer("sns");

        let start_time =
            UNIX_EPOCH + Duration::from_millis(self.publish_time.parse::<u64>().unwrap());

        let mut span = tracer
            .span_builder("sns")
            .with_kind(SpanKind::Internal)
            .with_start_time(start_time)
            .with_end_time(SystemTime::now())
            .start_with_context(&tracer, current_context);
        
        let arn_parts: Vec<&str> = record.sns.topic_arn.split(":").collect();
        let topic_name = arn_parts[5].to_string();
        
        span.set_attribute(KeyValue::new("topicname", topic_name.clone()));
        span.set_attribute(KeyValue::new("topic_arn", record.sns.topic_arn.clone()));
        span.set_attribute(KeyValue::new("type", "Notification"));
        span.set_attribute(KeyValue::new("resource_names", topic_name.clone()));
        span.set_attribute(KeyValue::new("operation_name", "aws.sns"));
        span.set_attribute(KeyValue::new("message_id", record.sns.message_id.clone()));
    }
}