use aws_lambda_events::sns::{SnsMessage, SnsRecord};
use opentelemetry::trace::{
    FutureExt, Span, SpanContext, SpanId, SpanKind, TraceContextExt, TraceFlags, TraceId, TraceState, Tracer
};
use opentelemetry::{global, Context, KeyValue};
use opentelemetry_datadog::new_pipeline;
use serde::{Deserialize, Serialize};
use std::env;
use std::time::{Duration, SystemTime, UNIX_EPOCH};
use aws_lambda_events::sqs::SqsMessage;
use tracing::{info, instrument, Subscriber};
use tracing_opentelemetry::OpenTelemetrySpanExt;
use tracing_subscriber::{layer::SubscriberExt, Registry};

mod utils;

pub use utils::parse_name_from_arn;

pub fn observability() -> impl Subscriber + Send + Sync {
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

    Registry::default()
        .with(fmt_layer)
        .with(telemetry_layer)
        .with(logger)
        .with(tracing_subscriber::EnvFilter::from_default_env())
}

#[derive(Deserialize, Serialize)]
pub struct TracedMessage {
    trace_id: String,
    span_id: String,
    pub message: String,
    publish_time: String,
    #[serde(skip_serializing, skip_deserializing)]
    ctx: Option<Context>,
    #[serde(skip_serializing, skip_deserializing)]
    inflight_ctx: Option<Context>,
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
                ctx: None,
                inflight_ctx: None
            }
        } else {
            // No valid span context found
            Self {
                trace_id: "".to_string(),
                span_id: "".to_string(),
                message: serde_json::to_string(&message).unwrap(),
                publish_time: since_the_epoch.as_millis().to_string(),
                ctx: None,
                inflight_ctx: None
            }
        }
    }
}

impl From<&SnsRecord> for TracedMessage {
    fn from(value: &SnsRecord) -> Self {
        let mut traced_message: TracedMessage =
            serde_json::from_str(value.sns.message.as_str()).unwrap();

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

        traced_message.generate_inflight_span_for(value);

        traced_message
    }
}

impl From<SnsMessage> for TracedMessage {
    fn from(value: SnsMessage) -> Self {
        let mut traced_message: TracedMessage =
            serde_json::from_str(value.message.as_str()).unwrap();

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

        traced_message
    }
}

impl From<SnsRecord> for TracedMessage {
    fn from(value: SnsRecord) -> Self {
        let mut traced_message: TracedMessage =
            serde_json::from_str(value.sns.message.as_str()).unwrap();

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

        traced_message.generate_inflight_span_for(&value);

        traced_message
    }
}

impl From<&SqsMessage> for TracedMessage {
    fn from(value: &SqsMessage) -> Self {
        let sent_timestamp = value.attributes.get_key_value("SentTimestamp");

        let timestamp = match sent_timestamp {
            Some((_key, val)) => {
                let parsed_epoch_timstamp = val.parse::<u64>();
                match parsed_epoch_timstamp {
                    Ok(epoch_timstamp) => UNIX_EPOCH + Duration::from_millis(epoch_timstamp),
                    Err(_) => SystemTime::now(),
                }
            },
            None => SystemTime::now(),
        };

        let traced_message = TracedMessage::check_body_for_sns(value, timestamp);

        let traced_message = match traced_message {
            Some(mut message) => {
                message.generate_inflight_span_for_sqs(value, timestamp);

                message
            },
            None => {
                let mut traced_message: TracedMessage =
                serde_json::from_str(value.clone().body.unwrap().as_str()).unwrap();

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

                traced_message.generate_inflight_span_for_sqs(value, timestamp);

                traced_message
            },
        };

        traced_message
    }
}

impl TracedMessage {
    fn generate_inflight_span_for(&mut self, record: &SnsRecord) {
        let current_context = match &self.ctx {
            None => &tracing::Span::current().context(),
            Some(ctx) => ctx,
        };

        let tracer = global::tracer("sns");

        let start_time =
            UNIX_EPOCH + Duration::from_millis(self.publish_time.parse::<u64>().unwrap());

        let mut span = tracer
            .span_builder("aws.sns")
            .with_kind(SpanKind::Internal)
            .with_start_time(start_time)
            .with_end_time(SystemTime::now())
            .start_with_context(&tracer, current_context);

        let topic_name = parse_name_from_arn(&record.sns.topic_arn);

        span.set_attribute(KeyValue::new("operation_name", "aws.sns"));
        span.set_attribute(KeyValue::new("resource_names", topic_name.clone()));
        span.set_attribute(KeyValue::new("service", topic_name.clone()));
        span.set_attribute(KeyValue::new("service.name", topic_name.clone()));
        span.set_attribute(KeyValue::new("span.type", "web"));
        span.set_attribute(KeyValue::new("resource.name", topic_name.clone()));
        span.set_attribute(KeyValue::new("peer.service", env::var("DD_SERVICE").unwrap()));
        span.set_attribute(KeyValue::new("_inferred_span.tag_source", "self"));
        span.set_attribute(KeyValue::new("_inferred_span.synchronicity", "async"));
        span.set_attribute(KeyValue::new("type", record.sns.sns_message_type.clone()));
        span.set_attribute(KeyValue::new("subject", record.sns.subject.clone().unwrap_or("".to_string())));
        span.set_attribute(KeyValue::new("message_id", record.sns.message_id.clone()));
        span.set_attribute(KeyValue::new("topicname", topic_name.clone()));
        span.set_attribute(KeyValue::new("topic_arn", record.sns.topic_arn.clone()));
        
        span.set_attribute(KeyValue::new("peer.messaging.destination", topic_name.clone()));
        span.set_attribute(KeyValue::new("peer.messaging.system", "sns"));
        span.set_attribute(KeyValue::new("event_subscription_arn",record.event_subscription_arn.clone()));

        let inflight_ctx = Context::new().with_remote_span_context(span.span_context().clone());

        tracing::Span::current().set_parent(inflight_ctx.clone());
        self.inflight_ctx = Some(inflight_ctx);

    }

    fn generate_inflight_span_for_sns_message(&mut self, record: &SnsMessage, sns_end_date: Option<SystemTime>) {
        let current_context = match &self.ctx {
            None => &tracing::Span::current().context(),
            Some(ctx) => ctx,
        };

        let tracer = global::tracer("sns");

        let start_time =
            UNIX_EPOCH + Duration::from_millis(self.publish_time.parse::<u64>().unwrap());

            let end_time = match sns_end_date {
                Some(end_time) => end_time,
                None => SystemTime::now(),
            };

        let mut span = tracer
            .span_builder("aws.sns")
            .with_kind(SpanKind::Internal)
            .with_start_time(start_time)
            .with_end_time(end_time)
            .start_with_context(&tracer, current_context);

        let topic_name = parse_name_from_arn(&record.topic_arn);

        span.set_attribute(KeyValue::new("operation_name", "aws.sns"));
        span.set_attribute(KeyValue::new("resource_names", topic_name.clone()));
        span.set_attribute(KeyValue::new("service", topic_name.clone()));
        span.set_attribute(KeyValue::new("service.name", topic_name.clone()));
        span.set_attribute(KeyValue::new("span.type", "web"));
        span.set_attribute(KeyValue::new("resource.name", topic_name.clone()));
        span.set_attribute(KeyValue::new("peer.service", env::var("DD_SERVICE").unwrap_or("".to_string())));
        span.set_attribute(KeyValue::new("_inferred_span.tag_source", "self"));
        span.set_attribute(KeyValue::new("_inferred_span.synchronicity", "async"));
        span.set_attribute(KeyValue::new("type", record.sns_message_type.clone()));
        span.set_attribute(KeyValue::new("subject", record.subject.clone().unwrap_or("".to_string())));
        span.set_attribute(KeyValue::new("message_id", record.message_id.clone()));
        span.set_attribute(KeyValue::new("topicname", topic_name.clone()));
        span.set_attribute(KeyValue::new("topic_arn", record.topic_arn.clone()));
        span.set_attribute(KeyValue::new("peer.messaging.destination", topic_name.clone()));
        span.set_attribute(KeyValue::new("peer.messaging.system", "sns"));

        let inflight_ctx = Context::new().with_remote_span_context(span.span_context().clone());

        tracing::Span::current().set_parent(inflight_ctx.clone());
        self.inflight_ctx = Some(inflight_ctx);

    }

    fn generate_inflight_span_for_sqs(&mut self, record: &SqsMessage, timestamp: SystemTime) -> SystemTime {
        let parent_ctx = match &self.inflight_ctx{
            Some(ctx) => ctx,
            None => match &self.ctx {
                None => &tracing::Span::current().context(),
                Some(ctx) => ctx,
            },
        };

        let tracer = global::tracer("sqs");

        let mut span = tracer
            .span_builder("aws.sqs")
            .with_kind(SpanKind::Internal)
            .with_start_time(timestamp)
            .with_end_time(SystemTime::now())
            .start_with_context(&tracer, parent_ctx);
        
        let event_source_arn = record.event_source_arn.clone().unwrap();

        let queue_name = parse_name_from_arn(&event_source_arn);

        span.set_attribute(KeyValue::new("operation_name", "aws.sqs"));
        span.set_attribute(KeyValue::new("resource_names", queue_name.clone()));
        span.set_attribute(KeyValue::new("service", queue_name.clone()));
        span.set_attribute(KeyValue::new("service.name", queue_name.clone()));
        span.set_attribute(KeyValue::new("span.type", "web"));
        span.set_attribute(KeyValue::new("resource.name", queue_name.clone()));
        span.set_attribute(KeyValue::new("peer.service", env::var("DD_SERVICE").unwrap()));
        span.set_attribute(KeyValue::new("_inferred_span.tag_source", "self"));
        span.set_attribute(KeyValue::new("_inferred_span.synchronicity", "async"));
        span.set_attribute(KeyValue::new("queuename", queue_name.clone()));
        span.set_attribute(KeyValue::new("event_source_arn", record.event_source_arn.clone().unwrap_or("".to_string())));
        span.set_attribute(KeyValue::new("receipt_handle", record.receipt_handle.clone().unwrap_or("".to_string())));

        match record.attributes.get_key_value("ApproximateReceiveCount"){
            Some((_key, val)) => span.set_attribute(KeyValue::new("retry_count", val.clone())),
            None => (),
        }
        match record.attributes.get_key_value("SenderId"){
            Some((_key, val)) => span.set_attribute(KeyValue::new("sender_id", val.clone())),
            None => (),
        }

        let inflight_ctx = Context::new().with_remote_span_context(span.span_context().clone());

        tracing::Span::current().set_parent(inflight_ctx.clone());
        self.inflight_ctx = Some(inflight_ctx);

        timestamp
    }

    fn check_body_for_sns(record: &SqsMessage, sqs_start_time: SystemTime) -> Option<Self> {
        let body_json = serde_json::from_str::<serde_json::Value>(&record.body.clone().unwrap());

        if body_json.is_err() {
            info!("SQS message body is not valid json");
            return None;
        }

        let body_json = body_json.unwrap();

        let body_object = body_json.as_object();

        if body_object.is_none() {
            info!("Body cannot be parsed as valid json");
            return None;
        }

        let json_object = body_object.unwrap();

        if json_object.contains_key("TopicArn") && json_object.contains_key("Timestamp") {
            info!("JSON object contains 'TopicArn' and 'Timestamp' keys");
            // Body is an SNSMessage, generate the inferred span
            let sns_message:SnsMessage =  serde_json::from_str(&record.body.clone().unwrap()).unwrap();

            let mut traced_message: TracedMessage = sns_message.clone().into();

            traced_message.generate_inflight_span_for_sns_message(&sns_message, Some(sqs_start_time));

            return Some(traced_message);
        }

        None
    }
}

#[cfg(test)]
mod tests {
    use std::collections::HashMap;

    use super::*;

    #[test]
    fn can_parse_body_from_sns_message() {
        let body = r#"{
            "Type" : "Notification",
            "MessageId" : "040c2217-c596-5eb8-b743-7d49cdd8bb45",
            "TopicArn" : "arn:aws:sns:eu-west-1:8974298345:RustProductApiStack-ProductApiRustProductCreatedTopic9D0A62AC-1s82l8XerOZ4",
            "Message" : "{\"trace_id\":\"9e6dea824913af578a5543d9e2ded2b1\",\"span_id\":\"ec03c1496d57d99c\",\"message\":\"{\\\"product_id\\\":\\\"f80d60d0-cd26-4ff9-b617-11306d5b7e51\\\",\\\"name\\\":\\\"asdadasdafwevwevwev\\\",\\\"price\\\":12.99}\",\"publish_time\":\"1726219790545\"}",
            "Timestamp" : "2024-09-13T09:29:50.565Z",
            "SignatureVersion" : "1",
            "Signature" : "",
            "SigningCertURL" : "",
            "UnsubscribeURL" : ""
        }"#;

        let sqs_message = SqsMessage{
            body: Some(body.to_string()),
            message_id: None,
            receipt_handle: None,
            md5_of_body: None,
            md5_of_message_attributes: None,
            attributes: HashMap::new(),
            message_attributes: HashMap::new(),
            event_source_arn: None,
            event_source: None,
            aws_region: None,
        };

        let message = TracedMessage::check_body_for_sns(&sqs_message, SystemTime::now());

        assert!(message.is_some());
    }
}