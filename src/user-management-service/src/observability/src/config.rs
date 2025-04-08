//
// Unless explicitly stated otherwise all files in this repository are licensed
// under the Apache License Version 2.0.
// This product includes software developed at Datadog (https://www.datadoghq.com/).
// Copyright 2024 Datadog, Inc.
//
use opentelemetry::global;
use opentelemetry_datadog::new_pipeline;
use opentelemetry_sdk::trace::{Config, RandomIdGenerator, Sampler};
use std::env;
use tracing::Subscriber;
use tracing_subscriber::{layer::SubscriberExt, Registry};

/// Initialize the observability stack with DataDog integration
///
/// This configures the tracing system for use with DataDog, setting up 
/// appropriate layers for logging and tracing.
pub fn observability() -> impl Subscriber + Send + Sync {
    let mut config = Config::default();
    config.sampler = Box::new(Sampler::AlwaysOn);
    config.id_generator = Box::new(RandomIdGenerator::default());

    let tracer = new_pipeline()
        .with_service_name(env::var("DD_SERVICE").expect("DD_SERVICE is not set"))
        .with_agent_endpoint(
            env::var("DD_SERVICE_ENDPOINT").unwrap_or("http://127.0.0.1:8126".to_string()),
        )
        .with_api_version(opentelemetry_datadog::ApiVersion::Version05)
        .with_trace_config(config)
        .install_simple()
        .unwrap();

    let logger = tracing_subscriber::fmt::layer().json().flatten_event(true);
    let fmt_layer = tracing_subscriber::fmt::layer()
        .with_target(false)
        .without_time();

    let _ = global::set_tracer_provider(tracer.clone());

    Registry::default()
        .with(fmt_layer)
        .with(logger)
        .with(tracing_subscriber::EnvFilter::from_default_env())
}