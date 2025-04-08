//
// Unless explicitly stated otherwise all files in this repository are licensed
// under the Apache License Version 2.0.
// This product includes software developed at Datadog (https://www.datadoghq.com/).
// Copyright 2024 Datadog, Inc.
//

// Re-exports for backward compatibility
mod cloud_event;
mod config;
mod conversions;
mod spans;
mod tracing;
mod utils;

// Public exports
pub use cloud_event::CloudEvent;
pub use config::observability;
pub use tracing::{trace_request, trace_handler};
pub use utils::parse_name_from_arn;