/*
 * Unless explicitly stated otherwise all files in this repository are licensed under the Apache License Version 2.0.
 * This product includes software developed at Datadog (https://www.datadoghq.com/).
 * Copyright 2024 Datadog, Inc.
 */

package com.cdk.product.apiworker;

import com.cdk.constructs.SharedProps;
import software.amazon.awscdk.Stack;
import software.amazon.awscdk.StackProps;
import software.amazon.awscdk.services.dynamodb.ITable;
import software.amazon.awscdk.services.dynamodb.Table;
import software.amazon.awscdk.services.secretsmanager.ISecret;
import software.amazon.awscdk.services.secretsmanager.Secret;
import software.amazon.awscdk.services.sns.ITopic;
import software.amazon.awscdk.services.sns.Topic;
import software.amazon.awscdk.services.ssm.StringParameter;
import software.constructs.Construct;

public class ProductApiWorkerStack extends Stack {
    public ProductApiWorkerStack(final Construct scope, final String id) {
        this(scope, id, null);
    }

    public ProductApiWorkerStack(final Construct scope, final String id, final StackProps props) {
        super(scope, id, props);

        ISecret ddApiKeySecret = Secret.fromSecretCompleteArn(this, "DDApiKeySecret", System.getenv("DD_SECRET_ARN"));
        
        String serviceName = "JavaProductApi";
        String env = System.getenv("ENV") == null ? "dev" : System.getenv("ENV");
        String version = System.getenv("VERSION") == null ? "dev" : System.getenv("VERSION");
        
        SharedProps sharedProps = new SharedProps(serviceName, env, version, ddApiKeySecret);

        String priceCalculatedTopicArn = StringParameter.valueForStringParameter(this, "/java/product-pricing/product-calculated-topic");
        ITopic priceCalculatedTopic = Topic.fromTopicArn(this, "PriceCalculatedTopic", priceCalculatedTopicArn);
        
        String tableName = StringParameter.valueForStringParameter(this, "/java/product-api/table-name");
        ITable table = Table.fromTableName(this, "ProductApiTable", tableName);
        
        var pricingService = new ApiWorkerService(this, "JavaProductApiWorker", new ApiWorkerServiceProps(sharedProps, priceCalculatedTopic, table));
    }
}
