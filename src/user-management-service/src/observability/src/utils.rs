//
// Unless explicitly stated otherwise all files in this repository are licensed
// under the Apache License Version 2.0.
// This product includes software developed at Datadog (https://www.datadoghq.com/).
// Copyright 2024 Datadog, Inc.
//
pub fn parse_name_from_arn(arn: &str) -> String {
    let arn_parts: Vec<&str> = arn.split(":").collect();

    if arn_parts.len() < 5 {
        return "unknown_arn".to_string();
    }

    arn_parts[5].to_string()
}
