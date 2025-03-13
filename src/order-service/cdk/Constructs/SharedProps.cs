// Unless explicitly stated otherwise all files in this repository are licensed under the Apache License Version 2.0.
// This product includes software developed at Datadog (https://www.datadoghq.com/).
// Copyright 2024 Datadog, Inc.

using Amazon.CDK.AWS.SecretsManager;

namespace OrdersService.CDK.Constructs;

public record SharedProps(string ServiceName, string Env, string Version, string Team, string Domain, ISecret DDApiKeySecret, string DDSite);