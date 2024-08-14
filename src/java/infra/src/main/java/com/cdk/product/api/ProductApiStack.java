package com.cdk.product.api;

import com.cdk.constructs.SharedProps;
import software.amazon.awscdk.CfnOutput;
import software.amazon.awscdk.CfnOutputProps;
import software.amazon.awscdk.services.events.EventBus;
import software.amazon.awscdk.services.secretsmanager.ISecret;
import software.amazon.awscdk.services.secretsmanager.Secret;
import software.constructs.Construct;
import software.amazon.awscdk.Stack;
import software.amazon.awscdk.StackProps;

public class ProductApiStack extends Stack {
    public ProductApiStack(final Construct scope, final String id) {
        this(scope, id, null);
    }

    public ProductApiStack(final Construct scope, final String id, final StackProps props) {
        super(scope, id, props);

        ISecret ddApiKeySecret = Secret.fromSecretCompleteArn(this, "DDApiKeySecret", System.getenv("DD_SECRET_ARN"));
        
        String serviceName = "JavaProductApi";
        String env = "dev";
        String version = "latest";
        
        SharedProps sharedProps = new SharedProps(serviceName, env, version, ddApiKeySecret);
        
        var api = new ProductApi(this, "JavaProductApi", new ProductApiProps(sharedProps));
        
        var apiEndpointOutput = new CfnOutput(this, "JavaApiUrlOutput", CfnOutputProps.builder()
                .value(api.getApi().getApiEndpoint())
                .exportName("ApiEndpoint")
                .build());
    }
}
