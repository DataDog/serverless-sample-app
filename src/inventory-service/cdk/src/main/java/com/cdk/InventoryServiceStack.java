package com.cdk;

import com.cdk.constructs.SharedProps;
import com.cdk.inventory.acl.InventoryAcl;
import com.cdk.inventory.acl.InventoryAclProps;
import com.cdk.inventory.api.InventoryApiContainer;
import com.cdk.inventory.api.InventoryApiContainerProps;
import com.cdk.inventory.ordering.InventoryOrderingService;
import com.cdk.inventory.ordering.InventoryOrderingServiceProps;
import software.amazon.awscdk.Stack;
import software.amazon.awscdk.StackProps;
import software.amazon.awscdk.services.events.EventBus;
import software.amazon.awscdk.services.events.IEventBus;
import software.amazon.awscdk.services.secretsmanager.ISecret;
import software.amazon.awscdk.services.secretsmanager.Secret;
import software.amazon.awscdk.services.ssm.IStringParameter;
import software.amazon.awscdk.services.ssm.StringParameter;
import software.constructs.Construct;

public class InventoryServiceStack  extends Stack {

    public InventoryServiceStack(final Construct scope, final String id, final StackProps props) {
        super(scope, id, props);

        ISecret ddApiKeySecret = Secret.fromSecretCompleteArn(this, "DDApiKeySecret", System.getenv("DD_API_KEY_SECRET_ARN"));

        String serviceName = "InventoryService";
        String env = System.getenv("ENV") == null ? "dev" : System.getenv("ENV");
        String version = System.getenv("VERSION") == null ? "dev" : System.getenv("VERSION");

        SharedProps sharedProps = new SharedProps(serviceName, env, version, ddApiKeySecret);

        String eventBusName = StringParameter.valueForStringParameter(this, String.format("/%s/shared/event-bus-name", env));
        IEventBus sharedBus = EventBus.fromEventBusName(this, "SharedEventBus", eventBusName);

        IStringParameter jwtAccessKeyParameterName = StringParameter.fromStringParameterName(this, "JwtAccessKeyParameter", String.format("/%s/shared/secret-access-key", env));

        var api = new InventoryApiContainer(this, "InventoryApi", new InventoryApiContainerProps(sharedProps, sharedBus, jwtAccessKeyParameterName));

        var acl = new InventoryAcl(this, "InventoryACL", new InventoryAclProps(sharedProps, sharedBus));

        new InventoryOrderingService(this, "InventoryOrdering", new InventoryOrderingServiceProps(sharedProps, api.getTable(), acl.getNewProductAddedTopic()));
    }
}