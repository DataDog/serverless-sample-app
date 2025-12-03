use anyhow::{Context, Result};
use opentelemetry::global;
use opentelemetry::trace::TracerProvider;
use opentelemetry_appender_tracing::layer;
use opentelemetry_resource_detectors::{OsResourceDetector, ProcessResourceDetector};
use opentelemetry_sdk::{Resource, logs::SdkLoggerProvider, propagation::TraceContextPropagator};
use tracing_opentelemetry::OpenTelemetryLayer;
use tracing_subscriber::{EnvFilter, layer::SubscriberExt, prelude::*, util::SubscriberInitExt};

use std::env;

// get_resource returns a Resource containing information about the environment
// The Resource is used to provide context to Traces, Metrics and Logs
// It is created by merging the results of multiple ResourceDetectors
// The ResourceDetectors are responsible for detecting information about the environment
fn get_resource() -> Resource {
    Resource::builder()
        .with_service_name(env::var("DD_SERVICE").unwrap_or("userservice".to_string())) // Default service name, can be overridden by OTEL_SERVICE_NAME env var
        .with_detector(Box::new(OsResourceDetector))
        .with_detector(Box::new(ProcessResourceDetector))
        .build()
}

// A Tracer Provider is a factory for Tracers
// A Tracer creates spans containing more information about what is happening for a given operation,
// such as a request in a service.
fn init_tracer() -> (
    opentelemetry_sdk::trace::SdkTracerProvider,
    SdkLoggerProvider,
) {
    global::set_text_map_propagator(TraceContextPropagator::new());

    let exporter = opentelemetry_otlp::SpanExporter::builder()
        .with_tonic()
        .build()
        .expect("Failed to create span exporter");

    let tracer_provider = opentelemetry_sdk::trace::SdkTracerProvider::builder()
        .with_batch_exporter(exporter)
        .with_resource(get_resource())
        .build();

    let tracer = tracer_provider
        .tracer(env::var("DD_SERVICE").unwrap_or_else(|_| "userservice-unknown".into()));

    let otel_layer = OpenTelemetryLayer::new(tracer);
    let exporter = opentelemetry_stdout::LogExporter::default();
    let provider: SdkLoggerProvider = SdkLoggerProvider::builder()
        .with_resource(
            Resource::builder()
                .with_service_name(
                    env::var("DD_SERVICE").unwrap_or_else(|_| "userservice-unknown".into()),
                )
                .build(),
        )
        .with_simple_exporter(exporter)
        .build();

    let filter_otel = EnvFilter::new(env::var("LOG_LEVEL").unwrap_or("info".to_string()))
        .add_directive("hyper=off".parse().expect("hardcoded parse to be valid"))
        .add_directive(
            "opentelemetry=off"
                .parse()
                .expect("hardcoded parse to be valid"),
        )
        .add_directive("tonic=off".parse().expect("hardcoded parse to be valid"))
        .add_directive("h2=off".parse().expect("hardcoded parse to be valid"))
        .add_directive("reqwest=off".parse().expect("hardcoded parse to be valid"));
    let otel_bridge_layer =
        layer::OpenTelemetryTracingBridge::new(&provider).with_filter(filter_otel);

    let env_filter = EnvFilter::new(env::var("LOG_LEVEL").unwrap_or("info".to_string()))
        .add_directive(
            "opentelemetry=info"
                .parse()
                .expect("hardcoded parse to be valid"),
        );

    // Set up tracing subscriber with both fmt and OpenTelemetry layers
    tracing_subscriber::registry()
        .with(otel_layer)
        .with(otel_bridge_layer)
        .with(env_filter)
        .with(
            tracing_subscriber::fmt::layer()
                .with_target(true)
                .with_thread_ids(true)
                .with_line_number(true),
        )
        .init();

    tracing::info!("OpenTelemetry initialized with OTLP trace export to http://localhost:4317");

    (tracer_provider, provider)
}

// A Meter Provider is a factory for Meters
// A Meter creates metric instruments, capturing measurements about a service at runtime.
fn init_meter_provider() -> Result<opentelemetry_sdk::metrics::SdkMeterProvider> {
    let exporter = opentelemetry_otlp::MetricExporter::builder()
        .with_tonic()
        .with_temporality(opentelemetry_sdk::metrics::Temporality::Delta)
        .build()
        .with_context(|| "creating metric exporter")?;

    let meter_provider = opentelemetry_sdk::metrics::SdkMeterProvider::builder()
        .with_reader(opentelemetry_sdk::metrics::PeriodicReader::builder(exporter).build())
        .with_resource(get_resource())
        .build();

    global::set_meter_provider(meter_provider.clone());

    Ok(meter_provider)
}

pub fn init_otel() -> Result<(
    opentelemetry_sdk::trace::SdkTracerProvider,
    opentelemetry_sdk::metrics::SdkMeterProvider,
    Option<opentelemetry_sdk::logs::SdkLoggerProvider>,
)> {
    let (tracer_provider, logger_provider) = init_tracer();
    let meter_provider = init_meter_provider().with_context(|| "initialising meter provider")?;

    Ok((tracer_provider, meter_provider, Some(logger_provider)))
}