package com.orders;

import com.orders.constructs.InstrumentedFunction;
import com.orders.constructs.InstrumentedFunctionProps;
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
import software.constructs.Construct;

import java.util.HashMap;
import java.util.List;

public class Api extends Construct {
    private final ITopic topic;
    private final ITable table;
    private final HttpApi api;
    
    public Api(@NotNull Construct scope, @NotNull String id, @NotNull ApiProps props) {
        super(scope, id);
        
        this.topic = new Topic(this, "TracedJavaTopic");
        
        this.table = new Table(this, "TracedJavaTable", TableProps.builder()
                .billingMode(BillingMode.PAY_PER_REQUEST)
                .tableClass(TableClass.STANDARD)
                .partitionKey(Attribute.builder()
                        .name("PK")
                        .type(AttributeType.STRING)
                        .build())
                .removalPolicy(RemovalPolicy.DESTROY)
                .build());

        HashMap<String, String> apiEnvironmentVariables = new HashMap<>(2);
        apiEnvironmentVariables.put("SNS_TOPIC_ARN", this.topic.getTopicArn());
        apiEnvironmentVariables.put("TABLE_NAME", this.table.getTableName());

        IFunction getOrderFunction = new InstrumentedFunction(this, "GetOrderJavaFunction",
                new InstrumentedFunctionProps(props.getSharedProps(), "handleGetOrder", apiEnvironmentVariables)).getAlias();
        HttpLambdaIntegration getOrderFunctionIntegration = new HttpLambdaIntegration("GetOrderFunctionIntegration", getOrderFunction);
        this.table.grantReadData(getOrderFunction);

        IFunction createOrderFunction = new InstrumentedFunction(this, "CreateOrderJavaFunction",
                new InstrumentedFunctionProps(props.getSharedProps(), "handleCreateOrder", apiEnvironmentVariables)).getAlias();
        HttpLambdaIntegration createOrderFunctionIntegration = new HttpLambdaIntegration("CreateOrderFunctionIntegration", createOrderFunction);
        this.table.grantWriteData(createOrderFunction);
        this.topic.grantPublish(createOrderFunction);

        this.api = new HttpApi(this, "TracedJavaApi");
        this.api.addRoutes(AddRoutesOptions.builder()
                        .integration(getOrderFunctionIntegration)
                        .methods(List.of(HttpMethod.GET))
                        .path("/order/{orderId}")
                .build());
        this.api.addRoutes(AddRoutesOptions.builder()
                .integration(createOrderFunctionIntegration)
                .methods(List.of(HttpMethod.POST))
                .path("/order")
                .build());
    }

    public ITopic getTopic(){
        return this.topic;
    }

    public ITable getTable(){
        return this.table;
    }

    public IHttpApi getApi() {
        return api;
    }
}
