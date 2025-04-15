// Unless explicitly stated otherwise all files in this repository are licensed under the Apache License Version 2.0.
// This product includes software developed at Datadog (https://www.datadoghq.com/).
// Copyright 2024 Datadog, Inc.

using System;
using System.Collections.Generic;
using System.Linq;
using Amazon.CDK;
using Amazon.CDK.AWS.IAM;
using Amazon.CDK.AWS.Lambda;
using Amazon.CDK.AWS.Lambda.DotNet;
using Amazon.CDK.AWS.Logs;
using Amazon.CDK.AWS.SecretsManager;
using Constructs;
using Environment = System.Environment;

namespace OrdersService.CDK.Constructs;

public record FunctionProps(
    SharedProps Shared,
    string FunctionName,
    string ProjectPath,
    string Handler,
    Dictionary<string, string> EnvironmentVariables,
    ISecret DdApiKeySecret);

public class InstrumentedFunction : Construct
{
    public IFunction Function { get; private set; }

    public InstrumentedFunction(Construct scope, string id, FunctionProps props) : base(scope, id)
    {
        if (props.Handler.Length > 128)
            throw new Exception(
                "Function handler cannot be greater than 128 chars. https://docs.aws.amazon.com/lambda/latest/api/API_CreateFunction.html#lambda-CreateFunction-request-Handler");
        var functionName = $"{props.Shared.ServiceName}-{props.FunctionName}-{props.Shared.Env}";

        if (functionName.Length > 64)
        {
            var extraCharacters = functionName.Length - 64;

            functionName =
                $"{props.Shared.ServiceName}-{props.FunctionName.Substring(0, props.FunctionName.Length - extraCharacters)}-{props.Shared.Env}";
        }

        var defaultEnvironmentVariables = new Dictionary<string, string>()
        {
            { "POWERTOOLS_SERVICE_NAME", props.Shared.ServiceName },
            { "POWERTOOLS_LOG_LEVEL", "DEBUG" },
            { "AWS_LAMBDA_EXEC_WRAPPER", "/opt/datadog_wrapper" },
            { "DD_SITE", Environment.GetEnvironmentVariable("DD_SITE") },
            { "DD_ENV", props.Shared.Env },
            { "ENV", props.Shared.Env },
            { "DD_VERSION", props.Shared.Version },
            { "DD_SERVICE", props.Shared.ServiceName },
            { "DD_API_KEY_SECRET_ARN", props.DdApiKeySecret.SecretArn },
            { "DD_CAPTURE_LAMBDA_PAYLOAD", "true" },
            { "DOMAIN", props.Shared.Domain },
            { "TEAM", props.Shared.Team }
        };

        Function = new DotNetFunction(this, id,
            new DotNetFunctionProps
            {
                ProjectDir = props.ProjectPath,
                Handler = props.Handler,
                MemorySize = 1024,
                Timeout = Duration.Seconds(29),
                Runtime = Runtime.DOTNET_8,
                Environment = defaultEnvironmentVariables.Union(props.EnvironmentVariables)
                    .ToDictionary(x => x.Key, x => x.Value),
                Architecture = Architecture.ARM_64,
                FunctionName = functionName,
                LogRetention = RetentionDays.ONE_DAY,
                Layers =
                [
                    LayerVersion.FromLayerVersionArn(this, "DDExtension",
                        $"arn:aws:lambda:{Environment.GetEnvironmentVariable("AWS_REGION") ?? "us-east-1"}:464622532012:layer:Datadog-Extension-ARM:77"),
                    LayerVersion.FromLayerVersionArn(this, "DDTrace",
                        $"arn:aws:lambda:{Environment.GetEnvironmentVariable("AWS_REGION") ?? "us-east-1"}:464622532012:layer:dd-trace-dotnet-ARM:20")
                ]
            });

        // The Datadog extension sends log data to Datadog using the telemetry API, disabling CloudWatch prevents 'double paying' for logs
        if (Environment.GetEnvironmentVariable("ENABLE_CLOUDWATCH_LOGS") != "Y")
            Function.AddToRolePolicy(new PolicyStatement(new PolicyStatementProps()
            {
                Resources = new[] { "arn:aws:logs:*:*:*" },
                Actions = new[]
                {
                    "logs:CreateLogGroup",
                    "logs:CreateLogStream",
                    "logs:PutLogEvents"
                },
                Effect = Effect.DENY
            }));

        props.DdApiKeySecret.GrantRead(Function);
    }
}