/*
 * Unless explicitly stated otherwise all files in this repository are licensed under the Apache License Version 2.0.
 * This product includes software developed at Datadog (https://www.datadoghq.com/).
 * Copyright 2024 Datadog, Inc.
 */

package com.cdk.inventory.ordering;

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

public class InventoryOrderingServiceStack extends Stack {

    public InventoryOrderingServiceStack(final Construct scope, final String id, final StackProps props) {
        super(scope, id, props);

        ISecret ddApiKeySecret = Secret.fromSecretCompleteArn(this, "DDApiKeySecret", System.getenv("DD_API_KEY_SECRET_ARN"));
        
        String serviceName = "JavaInventoryOrderingService";
        String env = System.getenv("ENV") == null ? "dev" : System.getenv("ENV");
        String version = System.getenv("VERSION") == null ? "dev" : System.getenv("VERSION");
        
        SharedProps sharedProps = new SharedProps(serviceName, env, version, ddApiKeySecret);

        String productAddedTopicArn = StringParameter.valueForStringParameter(this, "/java/inventory/product-added-topic");
        ITopic productAddedTopic = Topic.fromTopicArn(this, "ProductAddedTopic", productAddedTopicArn);

        String tableName = StringParameter.valueForStringParameter(this, String.format("/java/%s/inventory-api/table-name", env));
        ITable table = Table.fromTableName(this, "InventoryApiTable", tableName);
        
        new InventoryOrderingService(this, "JavaInventoryOrderingService", new InventoryOrderingServiceProps(sharedProps, table, productAddedTopic));
    }
}
