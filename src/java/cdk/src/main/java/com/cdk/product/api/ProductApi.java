/*
 * Unless explicitly stated otherwise all files in this repository are licensed under the Apache License Version 2.0.
 * This product includes software developed at Datadog (https://www.datadoghq.com/).
 * Copyright 2024 Datadog, Inc.
 */

package com.cdk.product.api;

import com.cdk.constructs.InstrumentedFunction;
import com.cdk.constructs.InstrumentedFunctionProps;
import org.jetbrains.annotations.NotNull;
import software.amazon.awscdk.RemovalPolicy;
import software.amazon.awscdk.aws_apigatewayv2_integrations.HttpLambdaIntegration;
import software.amazon.awscdk.services.apigateway.CorsOptions;
import software.amazon.awscdk.services.apigateway.LambdaIntegration;
import software.amazon.awscdk.services.apigateway.RestApi;
import software.amazon.awscdk.services.apigateway.RestApiProps;
import software.amazon.awscdk.services.apigatewayv2.AddRoutesOptions;
import software.amazon.awscdk.services.apigatewayv2.HttpApi;
import software.amazon.awscdk.services.apigatewayv2.HttpMethod;
import software.amazon.awscdk.services.apigatewayv2.IHttpApi;
import software.amazon.awscdk.services.dynamodb.*;
import software.amazon.awscdk.services.lambda.IFunction;
import software.amazon.awscdk.services.sns.ITopic;
import software.amazon.awscdk.services.sns.Topic;
import software.amazon.awscdk.services.sns.TopicProps;
import software.amazon.awscdk.services.ssm.StringParameter;
import software.amazon.awscdk.services.ssm.StringParameterProps;
import software.constructs.Construct;

import java.util.HashMap;
import java.util.List;

public class ProductApi extends Construct {
    private final ITable table;
    private final RestApi api;
    
    public ProductApi(@NotNull Construct scope, @NotNull String id, @NotNull ProductApiProps props) {
        super(scope, id);

        this.table = new Table(this, "TracedJavaTable", TableProps.builder()
                .billingMode(BillingMode.PAY_PER_REQUEST)
                .tableClass(TableClass.STANDARD)
                .partitionKey(Attribute.builder()
                        .name("PK")
                        .type(AttributeType.STRING)
                        .build())
                .removalPolicy(RemovalPolicy.DESTROY)
                .build());

        ITopic productCreatedTopic = new Topic(this, "JavaProductCreatedTopic", TopicProps.builder()
                .topicName(String.format("ProductCreated-%s", props.sharedProps().env()))
                .build());
        ITopic productUpdatedTopic = new Topic(this, "JavaProductUpdatedTopic", TopicProps.builder()
                .topicName(String.format("ProductUpdated-%s", props.sharedProps().env()))
                .build());
        ITopic productDeletedTopic = new Topic(this, "JavaProductDeletedTopic", TopicProps.builder()
                .topicName(String.format("ProductDeleted-%s", props.sharedProps().env()))
                .build());

        HashMap<String, String> apiEnvironmentVariables = new HashMap<>(2);
        apiEnvironmentVariables.put("TABLE_NAME", this.table.getTableName());
        apiEnvironmentVariables.put("PRODUCT_CREATED_TOPIC_ARN", productCreatedTopic.getTopicArn());
        apiEnvironmentVariables.put("PRODUCT_UPDATED_TOPIC_ARN", productUpdatedTopic.getTopicArn());
        apiEnvironmentVariables.put("PRODUCT_DELETED_TOPIC_ARN", productDeletedTopic.getTopicArn());
        
        String apiJarFile = "../product-api/target/com.product.api-0.0.1-SNAPSHOT-aws.jar";
        String packageName = "com.product.api";

        IFunction listProductFunction = new InstrumentedFunction(this, "ListProductJavaFunction",
                new InstrumentedFunctionProps(props.sharedProps(), packageName, apiJarFile,"handleListProduct", apiEnvironmentVariables)).getFunction();

        this.table.grantReadData(listProductFunction);
        
        IFunction getProductFunction = new InstrumentedFunction(this, "GetProductJavaFunction",
                new InstrumentedFunctionProps(props.sharedProps(), packageName, apiJarFile,"handleGetProduct", apiEnvironmentVariables)).getFunction();
        
        this.table.grantReadData(getProductFunction);
        
        HashMap<String, String> createProductFunctionEnvVars = new HashMap<>();
        createProductFunctionEnvVars.put("DD_SERVICE_MAPPING", String.format("lambda_sns:%s", productCreatedTopic.getTopicName()));
        createProductFunctionEnvVars.putAll(apiEnvironmentVariables);
        
        IFunction createProductFunction = new InstrumentedFunction(this, "CreateProductJavaFunction",
                new InstrumentedFunctionProps(props.sharedProps(), packageName, apiJarFile, "handleCreateProduct", createProductFunctionEnvVars)).getFunction();
        this.table.grantReadWriteData(createProductFunction);
        productCreatedTopic.grantPublish(createProductFunction);

        HashMap<String, String> updateProductFunctionEnvVars = new HashMap<>();
        updateProductFunctionEnvVars.put("DD_SERVICE_MAPPING", String.format("lambda_sns:%s", productUpdatedTopic.getTopicName()));
        updateProductFunctionEnvVars.putAll(apiEnvironmentVariables);

        IFunction updateProductFunction = new InstrumentedFunction(this, "UpdateProductJavaFunction",
                new InstrumentedFunctionProps(props.sharedProps(), packageName, apiJarFile, "handleUpdateProduct", updateProductFunctionEnvVars)).getFunction();
        this.table.grantReadWriteData(updateProductFunction);
        productUpdatedTopic.grantPublish(updateProductFunction);

        HashMap<String, String> deleteProductFunctionEnvVars = new HashMap<>();
        deleteProductFunctionEnvVars.put("DD_SERVICE_MAPPING", String.format("lambda_sns:%s", productDeletedTopic.getTopicName()));
        deleteProductFunctionEnvVars.putAll(apiEnvironmentVariables);
        
        IFunction deleteProductFunction = new InstrumentedFunction(this, "DeleteProductJavaFunction",
                new InstrumentedFunctionProps(props.sharedProps(), packageName, apiJarFile, "handleDeleteProduct", deleteProductFunctionEnvVars)).getFunction();
        this.table.grantReadWriteData(deleteProductFunction);
        productDeletedTopic.grantPublish(deleteProductFunction);

        this.api = new RestApi(this, "TracedJavaApi", RestApiProps.builder()
                .defaultCorsPreflightOptions(CorsOptions.builder()
                        .allowMethods(List.of("GET", "PUT", "POST", "DELETE"))
                        .allowOrigins(List.of("http://localhost:8080"))
                        .allowHeaders(List.of("*"))
                        .build())
                .build());
        var productApiResource = this.api.getRoot().addResource("product");
        productApiResource.addMethod("GET", new LambdaIntegration(listProductFunction));
        productApiResource.addMethod("POST", new LambdaIntegration(createProductFunction));
        productApiResource.addMethod("PUT", new LambdaIntegration(updateProductFunction));
        
        var specificProductResource = productApiResource.addResource("{productId}");
        specificProductResource.addMethod("GET", new LambdaIntegration(getProductFunction));
        specificProductResource.addMethod("DELETE", new LambdaIntegration(deleteProductFunction));
        

        StringParameter productCreatedTopicArnParam = new StringParameter(this, "ProductCreatedTopicArn", StringParameterProps.builder()
                .parameterName("/java/product-api/product-created-topic")
                .stringValue(productCreatedTopic.getTopicArn())
                .build());
        StringParameter productCreatedTopicNameParam = new StringParameter(this, "ProductCreatedTopicName", StringParameterProps.builder()
                .parameterName("/java/product-api/product-created-topic-name")
                .stringValue(productCreatedTopic.getTopicName())
                .build());

        StringParameter productUpdatedTopicArnParam = new StringParameter(this, "ProductUpdatedTopicArn", StringParameterProps.builder()
                .parameterName("/java/product-api/product-updated-topic")
                .stringValue(productUpdatedTopic.getTopicArn())
                .build());
        StringParameter productUpdatedTopicNameParam = new StringParameter(this, "ProductUpdatedTopicName", StringParameterProps.builder()
                .parameterName("/java/product-api/product-updated-topic-name")
                .stringValue(productUpdatedTopic.getTopicName())
                .build());

        StringParameter productDeletedTopicArnParam = new StringParameter(this, "ProductDeletedTopicArn", StringParameterProps.builder()
                .parameterName("/java/product-api/product-deleted-topic")
                .stringValue(productDeletedTopic.getTopicArn())
                .build());
        StringParameter productDeletedTopicNameParam = new StringParameter(this, "ProductDeletedTopicName", StringParameterProps.builder()
                .parameterName("/java/product-api/product-deleted-topic-name")
                .stringValue(productDeletedTopic.getTopicName())
                .build());
        StringParameter tableNameParameter = new StringParameter(this, "TableNameParameter", StringParameterProps.builder()
                .parameterName("/java/product-api/table-name")
                .stringValue(this.table.getTableName())
                .build());

        StringParameter apiEndpoint = new StringParameter(this, "ApiEndpoint", StringParameterProps.builder()
                .parameterName("/java/product-api/api-endpoint")
                .stringValue(this.api.getUrl())
                .build());
        
    }

    public ITable getTable(){
        return this.table;
    }

    public IHttpApi getApi() {
        return api;
    }
}
