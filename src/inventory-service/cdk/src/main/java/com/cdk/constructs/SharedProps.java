/*
 * Unless explicitly stated otherwise all files in this repository are licensed under the Apache License Version 2.0.
 * This product includes software developed at Datadog (https://www.datadoghq.com/).
 * Copyright 2024 Datadog, Inc.
 */

package com.cdk.constructs;

import software.amazon.awscdk.services.secretsmanager.ISecret;

public record SharedProps(String service, String env, String version, ISecret ddApiKeySecret, String ddSite) {
}
