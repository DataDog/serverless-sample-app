use aws_lambda_events::cloudwatch_events::CloudWatchEvent;
use aws_lambda_events::http::HeaderMap;
use aws_lambda_events::sns::{SnsMessage, SnsRecord};
use aws_lambda_events::sqs::SqsMessage;
use lambda_http::{
    tracing::{self},
    Request, RequestExt,
};
use opentelemetry::global::BoxedSpan;
use opentelemetry::trace::{
    Span, SpanContext, SpanId, SpanKind, TraceContextExt, TraceFlags, TraceId, TraceState, Tracer,
};
use opentelemetry::{global, Context, KeyValue};
use opentelemetry_datadog::new_pipeline;
use serde::{Deserialize, Serialize};
use std::env;
use std::num::ParseIntError;
use std::time::{Duration, SystemTime, UNIX_EPOCH};
use tracing::{info, Subscriber};
use tracing_opentelemetry::OpenTelemetrySpanExt;
use tracing_subscriber::{layer::SubscriberExt, Registry};

mod utils;

pub use utils::parse_name_from_arn;

pub fn observability() -> impl Subscriber + Send + Sync {
    let tracer = new_pipeline()
        .with_service_name(env::var("DD_SERVICE").expect("DD_SERVICE is not set"))
        .with_agent_endpoint(
            env::var("DD_SERVICE_ENDPOINT").unwrap_or("http://127.0.0.1:8126".to_string()),
        )
        .with_api_version(opentelemetry_datadog::ApiVersion::Version05)
        .with_trace_config(
            opentelemetry_sdk::trace::config()
                .with_sampler(opentelemetry_sdk::trace::Sampler::AlwaysOn)
                .with_id_generator(opentelemetry_sdk::trace::RandomIdGenerator::default()),
        )
        .install_simple()
        .unwrap();

    let telemetry_layer = tracing_opentelemetry::layer().with_tracer(tracer.clone());
    let logger = tracing_subscriber::fmt::layer().json().flatten_event(true);
    let fmt_layer = tracing_subscriber::fmt::layer()
        .with_target(false)
        .without_time();

    global::set_tracer_provider(tracer.provider().unwrap());

    Registry::default()
        .with(fmt_layer)
        .with(telemetry_layer)
        .with(logger)
        .with(tracing_subscriber::EnvFilter::from_default_env())
}

pub fn trace_request(event: &Request) -> BoxedSpan {
    let current_span = tracing::Span::current();

    let tracer = global::tracer(env::var("DD_SERVICE").expect("DD_SERVICE is not set"));
    let mut handler_span = tracer
        .span_builder(String::from("aws.lambda"))
        .with_kind(opentelemetry::trace::SpanKind::Internal)
        .start(&tracer);

    current_span
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

#[derive(Deserialize, Serialize)]
pub struct TracedMessage {
    trace_id: String,
    span_id: String,
    pub data: String,
    publish_time: String,
    #[serde(skip_serializing, skip_deserializing)]
    span_ctx: Option<SpanContext>,
    #[serde(skip_serializing, skip_deserializing)]
    ctx: Option<Context>,
    #[serde(skip_serializing, skip_deserializing)]
    inflight_ctx: Option<Context>,
    #[serde(skip_serializing, skip_deserializing)]
    pub message_type: Option<String>,
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
                data: serde_json::to_string(&message).unwrap(),
                publish_time: since_the_epoch.as_millis().to_string(),
                ctx: None,
                inflight_ctx: None,
                span_ctx: None,
                message_type: None,
            }
        } else {
            // No valid span context found
            Self {
                trace_id: "".to_string(),
                span_id: "".to_string(),
                data: serde_json::to_string(&message).unwrap(),
                publish_time: since_the_epoch.as_millis().to_string(),
                ctx: None,
                inflight_ctx: None,
                span_ctx: None,
                message_type: None,
            }
        }
    }
}

impl From<&SnsRecord> for TracedMessage {
    fn from(value: &SnsRecord) -> Self {
        let mut traced_message: TracedMessage =
            serde_json::from_str(value.sns.message.as_str()).unwrap();

        traced_message.generate_span_context();

        traced_message.generate_inflight_span_for_sns(value);

        traced_message
    }
}

impl From<SnsMessage> for TracedMessage {
    fn from(value: SnsMessage) -> Self {
        let mut traced_message: TracedMessage =
            serde_json::from_str(value.message.as_str()).unwrap();

        traced_message.generate_span_context();

        traced_message
    }
}

impl From<SnsRecord> for TracedMessage {
    fn from(value: SnsRecord) -> Self {
        let mut traced_message: TracedMessage =
            serde_json::from_str(value.sns.message.as_str()).unwrap();

        traced_message.generate_span_context();

        traced_message.generate_inflight_span_for_sns(&value);

        traced_message
    }
}

impl From<CloudWatchEvent> for TracedMessage {
    fn from(value: CloudWatchEvent) -> Self {
        let mut traced_message: TracedMessage =
            serde_json::from_value(value.detail.clone().unwrap()).unwrap();

        traced_message.generate_span_context();

        traced_message.generate_inflight_span_for_event_bridge(&value, None);

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
            }
            None => SystemTime::now(),
        };

        let traced_message = TracedMessage::check_body_for_upstream_message(value, timestamp);

        let traced_message = match traced_message {
            Some(mut message) => {
                message.generate_inflight_span_for_sqs(value, timestamp);

                message
            }
            None => {
                let mut traced_message: TracedMessage =
                    serde_json::from_str(value.clone().body.unwrap().as_str()).unwrap();

                traced_message.generate_span_context();

                traced_message.generate_inflight_span_for_sqs(value, timestamp);

                traced_message
            }
        };

        traced_message
    }
}

impl TryFrom<&HeaderMap> for TracedMessage {
    type Error = &'static str;

    fn try_from(value: &HeaderMap) -> Result<Self, Self::Error> {
        let traceparent_header = value.get("traceparent");

        match traceparent_header {
            Some(header_value) => {
                tracing::info!("Found traceparent header: {:?}", header_value);

                let traceparent = header_value.to_str().unwrap().to_string();
                let parts: Vec<&str> = traceparent.split("-").collect();

                let trace_id = TraceId::from_hex(parts[1]).unwrap();
                let span_id = SpanId::from_hex(parts[2]).unwrap();

                let span_context = SpanContext::new(
                    trace_id,
                    span_id,
                    TraceFlags::SAMPLED,
                    false,
                    TraceState::NONE,
                );

                let mut traced_message = TracedMessage {
                    trace_id: parts[1].to_string(),
                    span_id: parts[2].to_string(),
                    data: "".to_string(),
                    publish_time: "".to_string(),
                    ctx: Some(Context::new().with_remote_span_context(span_context.clone())),
                    span_ctx: None,
                    inflight_ctx: None,
                    message_type: None,
                };

                traced_message
                    .update_current_context(Context::new().with_remote_span_context(span_context));

                Ok(traced_message)
            }
            None => Err("No traceparent header"),
        }
    }
}

impl TracedMessage {
    fn generate_span_context(&mut self) {
        let trace_id = TraceId::from_hex(&self.trace_id.as_str());
        
        match trace_id {
            Ok(trace_id) => {
                let span_id = SpanId::from_hex(&self.span_id.as_str()).unwrap();

                let span_context = SpanContext::new(
                    trace_id,
                    span_id,
                    TraceFlags::SAMPLED,
                    false,
                    TraceState::NONE,
                );

                self.span_ctx = Some(span_context.clone());
                self.ctx = Some(Context::new().with_remote_span_context(span_context.clone()));
            }
            Err(_) => {
                self.span_ctx = None;
                self.ctx = None;
            }
        }
    }

    fn generate_inflight_span_for_sns(&mut self, record: &SnsRecord) {
        let current_context = match &self.ctx {
            None => &tracing::Span::current().context(),
            Some(ctx) => ctx,
        };

        let topic_name = parse_name_from_arn(&record.sns.topic_arn);

        let tracer = global::tracer(topic_name.clone());

        let start_time =
            UNIX_EPOCH + Duration::from_millis(self.publish_time.parse::<u64>().unwrap());

        let mut span = tracer
            .span_builder("aws.sns")
            .with_kind(SpanKind::Internal)
            .with_start_time(start_time)
            .with_end_time(SystemTime::now())
            .start_with_context(&tracer, current_context);

        span.set_attribute(KeyValue::new("operation_name", "aws.sns"));
        span.set_attribute(KeyValue::new("resource_names", topic_name.clone()));
        span.set_attribute(KeyValue::new("service", topic_name.clone()));
        span.set_attribute(KeyValue::new("service.name", topic_name.clone()));
        span.set_attribute(KeyValue::new("span.type", "web"));
        span.set_attribute(KeyValue::new("resource.name", topic_name.clone()));
        span.set_attribute(KeyValue::new(
            "peer.service",
            env::var("DD_SERVICE").unwrap(),
        ));
        span.set_attribute(KeyValue::new("_inferred_span.tag_source", "self"));
        span.set_attribute(KeyValue::new("_inferred_span.synchronicity", "async"));
        span.set_attribute(KeyValue::new("type", record.sns.sns_message_type.clone()));
        span.set_attribute(KeyValue::new(
            "subject",
            record.sns.subject.clone().unwrap_or("".to_string()),
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

        let inflight_ctx = Context::new().with_remote_span_context(span.span_context().clone());

        self.update_current_context(inflight_ctx);
    }

    fn generate_inflight_span_for_event_bridge(
        &mut self,
        record: &CloudWatchEvent,
        sqs_start_time: Option<SystemTime>,
    ) {
        let current_context = match &self.ctx {
            None => &tracing::Span::current().context(),
            Some(ctx) => ctx,
        };

        let bus_name = parse_name_from_arn(&record.source.clone().unwrap());

        let tracer = global::tracer(bus_name.clone());

        let start_time =
            UNIX_EPOCH + Duration::from_millis(self.publish_time.parse::<u64>().unwrap());

        let end_time = match sqs_start_time {
            Some(end_time) => end_time,
            None => SystemTime::now(),
        };

        let mut span = tracer
            .span_builder("aws.sns")
            .with_kind(SpanKind::Internal)
            .with_start_time(start_time)
            .with_end_time(end_time)
            .start_with_context(&tracer, current_context);

        span.set_attribute(KeyValue::new("operation_name", "aws.sns"));
        span.set_attribute(KeyValue::new("resource_names", bus_name.clone()));
        span.set_attribute(KeyValue::new("service", bus_name.clone()));
        span.set_attribute(KeyValue::new("service.name", bus_name.clone()));
        span.set_attribute(KeyValue::new("span.type", "web"));
        span.set_attribute(KeyValue::new("resource.name", bus_name.clone()));
        span.set_attribute(KeyValue::new(
            "peer.service",
            env::var("DD_SERVICE").unwrap_or("".to_string()),
        ));
        span.set_attribute(KeyValue::new("_inferred_span.tag_source", "self"));
        span.set_attribute(KeyValue::new("_inferred_span.synchronicity", "async"));

        span.set_attribute(KeyValue::new(
            "peer.messaging.destination",
            bus_name.clone(),
        ));

        let inflight_ctx = Context::new().with_remote_span_context(span.span_context().clone());

        self.update_current_context(inflight_ctx);
    }

    fn generate_inflight_span_for_sns_message(
        &mut self,
        record: &SnsMessage,
        sns_end_date: Option<SystemTime>,
    ) {
        let current_context = match &self.ctx {
            None => &tracing::Span::current().context(),
            Some(ctx) => ctx,
        };

        let topic_name = parse_name_from_arn(&record.topic_arn);

        let tracer = global::tracer(topic_name.clone());

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

        span.set_attribute(KeyValue::new("operation_name", "aws.sns"));
        span.set_attribute(KeyValue::new("resource_names", topic_name.clone()));
        span.set_attribute(KeyValue::new("service", topic_name.clone()));
        span.set_attribute(KeyValue::new("service.name", topic_name.clone()));
        span.set_attribute(KeyValue::new("span.type", "web"));
        span.set_attribute(KeyValue::new("resource.name", topic_name.clone()));
        span.set_attribute(KeyValue::new(
            "peer.service",
            env::var("DD_SERVICE").unwrap_or("".to_string()),
        ));
        span.set_attribute(KeyValue::new("_inferred_span.tag_source", "self"));
        span.set_attribute(KeyValue::new("_inferred_span.synchronicity", "async"));
        span.set_attribute(KeyValue::new("type", record.sns_message_type.clone()));
        span.set_attribute(KeyValue::new(
            "subject",
            record.subject.clone().unwrap_or("".to_string()),
        ));
        span.set_attribute(KeyValue::new("message_id", record.message_id.clone()));
        span.set_attribute(KeyValue::new("topicname", topic_name.clone()));
        span.set_attribute(KeyValue::new("topic_arn", record.topic_arn.clone()));
        span.set_attribute(KeyValue::new(
            "peer.messaging.destination",
            topic_name.clone(),
        ));

        let inflight_ctx = Context::new().with_remote_span_context(span.span_context().clone());
        self.update_current_context(inflight_ctx);
    }

    fn generate_inflight_span_for_sqs(
        &mut self,
        record: &SqsMessage,
        timestamp: SystemTime,
    ) -> SystemTime {
        let parent_ctx = match &self.inflight_ctx {
            Some(ctx) => ctx,
            None => match &self.ctx {
                None => &tracing::Span::current().context(),
                Some(ctx) => ctx,
            },
        };

        let event_source_arn = record.event_source_arn.clone().unwrap();

        let queue_name = parse_name_from_arn(&event_source_arn);

        let tracer = global::tracer(queue_name.clone());

        let mut span = tracer
            .span_builder("aws.sqs")
            .with_kind(SpanKind::Internal)
            .with_start_time(timestamp)
            .with_end_time(SystemTime::now())
            .start_with_context(&tracer, parent_ctx);

        span.set_attribute(KeyValue::new("operation_name", "aws.sqs"));
        span.set_attribute(KeyValue::new("resource_names", queue_name.clone()));
        span.set_attribute(KeyValue::new("service", queue_name.clone()));
        span.set_attribute(KeyValue::new("service.name", queue_name.clone()));
        span.set_attribute(KeyValue::new("span.type", "web"));
        span.set_attribute(KeyValue::new("resource.name", queue_name.clone()));
        span.set_attribute(KeyValue::new(
            "peer.service",
            env::var("DD_SERVICE").unwrap(),
        ));
        span.set_attribute(KeyValue::new("_inferred_span.tag_source", "self"));
        span.set_attribute(KeyValue::new("_inferred_span.synchronicity", "async"));
        span.set_attribute(KeyValue::new("queuename", queue_name.clone()));
        span.set_attribute(KeyValue::new(
            "event_source_arn",
            record.event_source_arn.clone().unwrap_or("".to_string()),
        ));
        span.set_attribute(KeyValue::new(
            "receipt_handle",
            record.receipt_handle.clone().unwrap_or("".to_string()),
        ));

        match record.attributes.get_key_value("ApproximateReceiveCount") {
            Some((_key, val)) => span.set_attribute(KeyValue::new("retry_count", val.clone())),
            None => (),
        }
        match record.attributes.get_key_value("SenderId") {
            Some((_key, val)) => span.set_attribute(KeyValue::new("sender_id", val.clone())),
            None => (),
        }

        let inflight_ctx = Context::new().with_remote_span_context(span.span_context().clone());

        self.update_current_context(inflight_ctx);

        timestamp
    }

    fn check_body_for_upstream_message(
        record: &SqsMessage,
        sqs_start_time: SystemTime,
    ) -> Option<Self> {
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
            // Body is an SNSMessage, generate the inferred span
            let sns_message: SnsMessage =
                serde_json::from_str(&record.body.clone().unwrap()).unwrap();

            let mut traced_message: TracedMessage = sns_message.clone().into();

            traced_message
                .generate_inflight_span_for_sns_message(&sns_message, Some(sqs_start_time));

            return Some(traced_message);
        }

        if json_object.contains_key("detail") {
            // Body is an CloudWatch Event, generate the inferred span
            let sns_message: CloudWatchEvent =
                serde_json::from_str(&record.body.clone().unwrap()).unwrap();

            let mut traced_message: TracedMessage = sns_message.clone().into();

            traced_message.message_type = Some(
                sns_message
                    .detail_type
                    .clone()
                    .unwrap_or("Unknown message".to_string()),
            );
            traced_message
                .generate_inflight_span_for_event_bridge(&sns_message, Some(sqs_start_time));

            return Some(traced_message);
        }

        None
    }

    fn update_current_context(&mut self, inflight_ctx: Context) {
        self.inflight_ctx = Some(inflight_ctx.clone());

        match std::env::var("USE_SPAN_LINK") {
            Ok(use_links) => match use_links.as_str() {
                "true" => tracing::Span::current().add_link(self.span_ctx.clone().unwrap()),
                _ => tracing::Span::current().set_parent(inflight_ctx.clone()),
            },
            Err(_) => tracing::Span::current().set_parent(inflight_ctx.clone()),
        }
    }
}

#[cfg(test)]
mod tests {
    use std::collections::HashMap;

    use super::*;

    #[test]
    fn can_parse_sns_from_sqs_body() {
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

        let sqs_message = SqsMessage {
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

        let message =
            TracedMessage::check_body_for_upstream_message(&sqs_message, SystemTime::now());

        assert!(message.is_some());
    }

    #[test]
    fn can_parse_body_for_event_bridge_message() {
        let body = r#"{
            "version": "0",
            "id": "f460262a-48d3-3d43-ca66-2998bcc6d039",
            "detail-type": "product.productCreated.v1",
            "source": "dev.products",
            "account": "",
            "time": "2024-09-13T13:54:57Z",
            "region": "eu-west-1",
            "resources": [],
            "detail": {
                "trace_id": "540414187ffb9f96aa6990fc7a28366e",
                "span_id": "9385fb4d763c5093",
                "message": "{\"product_id\":\"b15b4b7e-12d7-4e28-be9e-7e435af367f9\"}",
                "publish_time": "1726235697648"
            }
        }"#;

        let sqs_message = SqsMessage {
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

        let message =
            TracedMessage::check_body_for_upstream_message(&sqs_message, SystemTime::now());

        assert!(message.is_some());
    }

    #[test]
    fn can_parse_from_sqs() {
        let body = r#"{
            "trace_id": "540414187ffb9f96aa6990fc7a28366e",
            "span_id": "9385fb4d763c5093",
            "message": "{\"product_id\":\"b15b4b7e-12d7-4e28-be9e-7e435af367f9\"}",
            "publish_time": "1726235697648"
        }"#;

        let sqs_message = SqsMessage {
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

        let message =
            TracedMessage::check_body_for_upstream_message(&sqs_message, SystemTime::now());

        assert!(message.is_none());
    }
}