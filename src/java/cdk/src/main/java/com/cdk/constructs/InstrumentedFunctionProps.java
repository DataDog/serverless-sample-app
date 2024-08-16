/*
 * Unless explicitly stated otherwise all files in this repository are licensed under the Apache License Version 2.0.
 * This product includes software developed at Datadog (https://www.datadoghq.com/).
 * Copyright 2024 Datadog, Inc.
 */

package com.cdk.constructs;

import java.util.HashMap;

public record InstrumentedFunctionProps(SharedProps sharedProps, String packageName, String jarFile,
                                        String routingExpression, HashMap<String, String> environmentVariables) {
}
