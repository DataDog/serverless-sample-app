package com.cdk.product.api;

import com.cdk.constructs.InstrumentedFunction;
import com.cdk.constructs.InstrumentedFunctionProps;
import org.jetbrains.annotations.NotNull;
import software.amazon.awscdk.RemovalPolicy;
import software.amazon.awscdk.aws_apigatewayv2_integrations.HttpLambdaIntegration;
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
    private final HttpApi api;
    
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
                .topicName(String.format("ProductCreated-%s", props.getSharedProps().getEnv()))
                .build());
        ITopic productUpdatedTopic = new Topic(this, "JavaProductUpdatedTopic", TopicProps.builder()
                .topicName(String.format("ProductUpdated-%s", props.getSharedProps().getEnv()))
                .build());
        ITopic productDeletedTopic = new Topic(this, "JavaProductDeletedTopic", TopicProps.builder()
                .topicName(String.format("ProductDeleted-%s", props.getSharedProps().getEnv()))
                .build());

        HashMap<String, String> apiEnvironmentVariables = new HashMap<>(2);
        apiEnvironmentVariables.put("TABLE_NAME", this.table.getTableName());
        apiEnvironmentVariables.put("PRODUCT_CREATED_TOPIC_ARN", productCreatedTopic.getTopicArn());
        apiEnvironmentVariables.put("PRODUCT_UPDATED_TOPIC_ARN", productUpdatedTopic.getTopicArn());
        apiEnvironmentVariables.put("PRODUCT_DELETED_TOPIC_ARN", productDeletedTopic.getTopicArn());
        
        String apiJarFile = "../product-api/target/com.product.api-0.0.1-SNAPSHOT-aws.jar";

        IFunction getProductFunction = new InstrumentedFunction(this, "GetProductJavaFunction",
                new InstrumentedFunctionProps(props.getSharedProps(), apiJarFile, "handleGetProduct", apiEnvironmentVariables)).getFunction();
        
        HttpLambdaIntegration getProductFunctionIntegration = new HttpLambdaIntegration("GetProductFunctionIntegration", getProductFunction);
        this.table.grantReadData(getProductFunction);
        
        IFunction createProductFunction = new InstrumentedFunction(this, "CreateProductJavaFunction",
                new InstrumentedFunctionProps(props.getSharedProps(), apiJarFile, "handleCreateProduct", apiEnvironmentVariables)).getFunction();
        HttpLambdaIntegration createProductFunctionIntegration = new HttpLambdaIntegration("CreateProductFunctionIntegration", createProductFunction);
        this.table.grantReadWriteData(createProductFunction);
        productCreatedTopic.grantPublish(createProductFunction);

        IFunction updateProductFunction = new InstrumentedFunction(this, "UpdateProductJavaFunction",
                new InstrumentedFunctionProps(props.getSharedProps(), apiJarFile, "handleUpdateProduct", apiEnvironmentVariables)).getFunction();
        HttpLambdaIntegration updateProductFunctionIntegration = new HttpLambdaIntegration("UpdateProductFunctionIntegration", updateProductFunction);
        this.table.grantReadWriteData(updateProductFunction);
        productUpdatedTopic.grantPublish(updateProductFunction);

        IFunction deleteProductFunction = new InstrumentedFunction(this, "DeleteProductJavaFunction",
                new InstrumentedFunctionProps(props.getSharedProps(), apiJarFile, "handleDeleteProduct", apiEnvironmentVariables)).getFunction();
        HttpLambdaIntegration deleteProductFunctionIntegration = new HttpLambdaIntegration("DeleteProductFunctionIntegration", deleteProductFunction);
        this.table.grantReadWriteData(deleteProductFunction);
        productDeletedTopic.grantPublish(deleteProductFunction);

        this.api = new HttpApi(this, "TracedJavaApi");
        this.api.addRoutes(AddRoutesOptions.builder()
                        .integration(getProductFunctionIntegration)
                        .methods(List.of(HttpMethod.GET))
                        .path("/product/{productId}")
                .build());
        this.api.addRoutes(AddRoutesOptions.builder()
                .integration(createProductFunctionIntegration)
                .methods(List.of(HttpMethod.POST))
                .path("/product")
                .build());
        this.api.addRoutes(AddRoutesOptions.builder()
                .integration(updateProductFunctionIntegration)
                .methods(List.of(HttpMethod.PUT))
                .path("/product")
                .build());
        this.api.addRoutes(AddRoutesOptions.builder()
                .integration(deleteProductFunctionIntegration)
                .methods(List.of(HttpMethod.DELETE))
                .path("/product/{productId}")
                .build());

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
                .stringValue(this.api.getApiEndpoint())
                .build());
        
    }

    public ITable getTable(){
        return this.table;
    }

    public IHttpApi getApi() {
        return api;
    }
}
