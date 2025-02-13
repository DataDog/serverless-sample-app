use opentelemetry::{global, trace::TracerProvider as _,
                    trace::{SpanKind, TraceContextExt},
                    Context,};
use opentelemetry_datadog::new_pipeline;
use opentelemetry_sdk::{
    runtime::{self, Tokio},
    trace::{Config, TracerProvider},
    Resource,
};
use std::env;
use tracing::{
    level_filters::LevelFilter,
    subscriber::{set_global_default, SetGlobalDefaultError},
    Subscriber,
};
use tracing_bunyan_formatter::{BunyanFormattingLayer, JsonStorageLayer};
use tracing_subscriber::{layer::SubscriberExt, EnvFilter, Registry};
use std::time::Duration;

use axum::{
    extract::MatchedPath,
    http::{header::USER_AGENT, Request, Response},
};
use opentelemetry_http::HeaderExtractor;
use opentelemetry_semantic_conventions::{
    attribute::OTEL_STATUS_CODE,
    trace::{
        HTTP_REQUEST_METHOD, HTTP_RESPONSE_STATUS_CODE, HTTP_ROUTE, NETWORK_PROTOCOL_VERSION,
        URL_FULL, USER_AGENT_ORIGINAL,
    },
};
use tower_http::{
    classify::{ServerErrorsAsFailures, SharedClassifier},
    trace::{MakeSpan, OnFailure, OnResponse, TraceLayer},
};
use tracing::{field::Empty, Span};
use tracing_opentelemetry::OpenTelemetrySpanExt;

pub fn use_datadog() -> bool {
    env::var("DD_SERVICE").is_ok()
}

pub fn use_otlp() -> bool {
    env::var("OTLP_ENDPOINT").is_ok()
}

pub fn dd_observability() -> (TracerProvider, impl Subscriber + Send + Sync) {
    let tracer: opentelemetry_sdk::trace::Tracer = new_pipeline()
        .with_service_name(env::var("DD_SERVICE").expect("DD_SERVICE is not set"))
        .with_agent_endpoint(
            env::var("DD_SERVICE_ENDPOINT").unwrap_or("http://127.0.0.1:8126".to_string()),
        )
        .with_trace_config(
            opentelemetry_sdk::trace::config()
                .with_sampler(opentelemetry_sdk::trace::Sampler::AlwaysOn)
                .with_id_generator(opentelemetry_sdk::trace::RandomIdGenerator::default()),
        )
        .with_api_version(opentelemetry_datadog::ApiVersion::Version05)
        .with_http_client(reqwest::Client::default())
        .install_batch(Tokio)
        .unwrap();

    let telemetry_layer = tracing_opentelemetry::layer().with_tracer(tracer.clone());
    let logger = tracing_subscriber::fmt::layer().json().flatten_event(true);
    let fmt_layer = tracing_subscriber::fmt::layer()
        .with_target(false)
        .without_time();

    global::set_tracer_provider(tracer.provider().unwrap());

    (
        tracer.provider().unwrap(),
        Registry::default()
            .with(fmt_layer)
            .with(telemetry_layer)
            .with(logger)
            .with(EnvFilter::from_default_env()),
    )
}

pub fn log_observability() -> impl Subscriber + Send + Sync {
    let env_filter = EnvFilter::try_from_default_env().unwrap_or_else(|_| EnvFilter::new("info"));
    let formatting_layer = BunyanFormattingLayer::new("web".to_string(), std::io::stdout);
    let fmt_layer = tracing_subscriber::fmt::layer()
        .with_target(false)
        .without_time();

    Registry::default()
        .with(env_filter)
        .with(JsonStorageLayer)
        .with(formatting_layer)
        .with(fmt_layer)
        .with(LevelFilter::DEBUG)
}

pub fn configure_instrumentation() -> Option<Result<(), SetGlobalDefaultError>> {
    let mut subscribe: Option<Result<(), SetGlobalDefaultError>> = None;

    if use_datadog() {
        println!("Configuring Datadog");
        let (_, dd_subscriber) = dd_observability();
        subscribe = Some(set_global_default(dd_subscriber));
    } else {
        println!("Configuring basic log subscriber");
        let _ = log_observability();
    }

    subscribe
}

#[derive(Clone)]
pub struct OtelMakeSpan {
    span_kind: SpanKind,
}

impl<B> MakeSpan<B> for OtelMakeSpan {
    fn make_span(&mut self, request: &Request<B>) -> Span {
        // Extract the path template as the request path such that it is unique for all
        // requests to this endpoint regardless of parameters within the path
        let path_template = request
            .extensions()
            .get::<MatchedPath>()
            .map(MatchedPath::as_str)
            .unwrap_or("{unknown}");

        let span = tracing::info_span!(
                "request",
                otel.name = format!("{} {}", request.method(), path_template),
                span.kind = ?self.span_kind,
                { OTEL_STATUS_CODE } = Empty,
                { HTTP_REQUEST_METHOD } = ?request.method(),
                { HTTP_RESPONSE_STATUS_CODE } = Empty,
                { HTTP_ROUTE } = %request.uri().path(),
                { URL_FULL } = %request.uri().path(),
                { NETWORK_PROTOCOL_VERSION } = ?request.version(),
                { USER_AGENT_ORIGINAL } = %request.headers().get(USER_AGENT).and_then(|h| h.to_str().ok()).unwrap_or_default(),
            );

        return span;
    }
}

// TODO: inject tracing headers into http client e.g. https://github.com/open-telemetry/opentelemetry-rust/blob/main/examples/tracing-http-propagator/src/client.rs
// Or might use `HttpClient` trait from opentelemetry_http https://docs.rs/opentelemetry-http/latest/src/opentelemetry_http/lib.rs.html#68
//#[derive(Clone)]
//pub struct OtelOnRequest {
//    span_kind: SpanKind,
//}
//impl<B> OnRequest<B> for OtelOnRequest {
//    fn on_request(&mut self, request: &Request<B>, span: &Span) {
//        if self.span_kind == SpanKind::Client {
//            global::get_text_map_propagator(|propagator| {
//                propagator.inject(&mut HeaderInjector(request.headers_mut()));
//            });
//        }
//    }
//}

#[derive(Clone)]
pub struct OtelOnResponse;
impl<B> OnResponse<B> for OtelOnResponse {
    fn on_response(self, response: &Response<B>, _latency: Duration, span: &Span) {
        let status_code = response.status().as_u16();
        let is_failure = if status_code < 300 { "ok" } else { "error" };
        span.record(OTEL_STATUS_CODE, is_failure);
        span.record(HTTP_RESPONSE_STATUS_CODE, status_code);
    }
}

#[derive(Clone)]
pub struct OtelOnFailure;
impl<B> OnFailure<B> for OtelOnFailure {
    fn on_failure(&mut self, _failure_classification: B, _latency: Duration, span: &Span) {
        span.record(OTEL_STATUS_CODE, "error");
    }
}

/// What the tracing layer is used for
pub enum TracingFor {
    /// The tracing layer is used to trace incoming, or server, requests
    Server,
    /// The tracing layer is used to trace outgoing, or client, requests
    Client,
}

/// A Tower layer that traces requests with opentelemetry tags
pub fn trace_layer(
    tracing_for: TracingFor,
) -> TraceLayer<
    SharedClassifier<ServerErrorsAsFailures>,
    OtelMakeSpan,
    (),
    OtelOnResponse,
    (),
    (),
    OtelOnFailure,
> {
    let span_kind = match tracing_for {
        TracingFor::Server => SpanKind::Server,
        TracingFor::Client => SpanKind::Client,
    };
    TraceLayer::new_for_http()
        .make_span_with(OtelMakeSpan { span_kind })
        .on_request(())
        .on_response(OtelOnResponse)
        .on_body_chunk(())
        .on_eos(())
        .on_failure(OtelOnFailure)
}
