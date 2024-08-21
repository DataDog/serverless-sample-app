/*
 * Unless explicitly stated otherwise all files in this repository are licensed under the Apache License Version 2.0.
 * This product includes software developed at Datadog (https://www.datadoghq.com/).
 * Copyright 2024 Datadog, Inc.
 */

package com.cdk.constructs;

import org.jetbrains.annotations.NotNull;
import software.amazon.awscdk.Duration;
import software.amazon.awscdk.services.lambda.*;
import software.amazon.awscdk.services.lambda.Runtime;
import software.amazon.awscdk.services.s3.Bucket;
import software.amazon.awscdk.services.s3.IBucket;
import software.amazon.awscdk.services.s3.assets.Asset;
import software.constructs.Construct;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

public class InstrumentedFunction extends Construct {
    private final IFunction function;
    private IAlias alias = null;

    public InstrumentedFunction(@NotNull Construct scope, @NotNull String id, @NotNull InstrumentedFunctionProps props) {
        super(scope, id);

        Asset fileAsset = Asset.Builder.create(this, String.format("%sS3Asset", props.routingExpression()))
                .path(props.jarFile()).build();

        Map<String, String> lambdaEnvironment = new HashMap<>();
        lambdaEnvironment.put("MAIN_CLASS", String.format("%s.FunctionConfiguration", props.packageName()));
        lambdaEnvironment.put("AWS_LAMBDA_EXEC_WRAPPER", "/opt/datadog_wrapper");
        lambdaEnvironment.put("DD_SITE", System.getenv("DD_SITE") == null ? "datadoghq.com" : System.getenv("DD_SITE"));
        lambdaEnvironment.put("DD_SERVICE", props.sharedProps().service());
        lambdaEnvironment.put("DD_ENV", props.sharedProps().env());
        lambdaEnvironment.put("ENV", props.sharedProps().env());
        lambdaEnvironment.put("DD_VERSION", props.sharedProps().version());
        lambdaEnvironment.put("DD_API_KEY_SECRET_ARN", props.sharedProps().ddApiKeySecret().getSecretArn());
        lambdaEnvironment.put("DD_CAPTURE_LAMBDA_PAYLOAD", "true");
        lambdaEnvironment.put("DD_LOGS_INJECTION", "true");
        lambdaEnvironment.put("spring_cloud_function_definition", props.routingExpression());

        // Add custom environment variables to the default set.
        lambdaEnvironment.putAll(props.environmentVariables());

        List<ILayerVersion> layers = new ArrayList<>(2);
        layers.add(LayerVersion.fromLayerVersionArn(this, "DatadogJavaLayer", "arn:aws:lambda:eu-west-1:464622532012:layer:dd-trace-java:15"));
        layers.add(LayerVersion.fromLayerVersionArn(this, "DatadogLambdaExtension", "arn:aws:lambda:eu-west-1:464622532012:layer:Datadog-Extension:64"));

        IBucket bucket = Bucket.fromBucketName(this, "CDKBucket", fileAsset.getS3BucketName());

        // Create our basic function
        var builder = Function.Builder.create(this, props.routingExpression())
                .functionName(String.format("%s-%s-%s", props.packageName().replace(".", ""), props.routingExpression(), props.sharedProps().env()))
                .runtime(Runtime.JAVA_21)
                .memorySize(2048)
                .handler("org.springframework.cloud.function.adapter.aws.FunctionInvoker::handleRequest")
                .environment(lambdaEnvironment)
                .timeout(Duration.seconds(30))
                .code(Code.fromBucket(bucket, fileAsset.getS3ObjectKey()))
                .layers(layers);
        
        if (props.sharedProps().env().equals("prod")) {
            builder.snapStart(SnapStartConf.ON_PUBLISHED_VERSIONS);
        }

        this.function = builder.build();
        
        if (props.sharedProps().env() == "prod") {
            var version = new Version(this, String.format("%sVersion", id), VersionProps.builder()
                    .lambda(this.function)
                    .build());

            this.alias = new Alias(this, String.format("%sAlias", id), AliasProps.builder()
                    .aliasName("prod")
                    .version(version)
                    .build());
        }

        props.sharedProps().ddApiKeySecret().grantRead(this.function);
    }

    public IFunction getFunction() {
        return this.alias == null ? this.function : this.alias;
    }
}
