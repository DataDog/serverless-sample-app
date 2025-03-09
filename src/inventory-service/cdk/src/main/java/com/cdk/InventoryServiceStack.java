package com.cdk;

import com.cdk.constructs.SharedProps;
import com.cdk.events.*;
import com.cdk.inventory.acl.InventoryAcl;
import com.cdk.inventory.acl.InventoryAclProps;
import com.cdk.inventory.api.InventoryApiContainer;
import com.cdk.inventory.api.InventoryApiContainerProps;
import com.cdk.inventory.ordering.InventoryOrderingService;
import com.cdk.inventory.ordering.InventoryOrderingServiceProps;
import software.amazon.awscdk.SecretValue;
import software.amazon.awscdk.Stack;
import software.amazon.awscdk.StackProps;
import software.amazon.awscdk.services.events.EventBus;
import software.amazon.awscdk.services.events.EventBusProps;
import software.amazon.awscdk.services.events.IEventBus;
import software.amazon.awscdk.services.secretsmanager.ISecret;
import software.amazon.awscdk.services.secretsmanager.Secret;
import software.amazon.awscdk.services.secretsmanager.SecretProps;
import software.amazon.awscdk.services.ssm.IStringParameter;
import software.amazon.awscdk.services.ssm.StringParameter;
import software.constructs.Construct;

import java.util.List;

public class InventoryServiceStack extends Stack {

    public InventoryServiceStack(final Construct scope, final String id, final StackProps props) {
        super(scope, id, props);

        var ddApiKey = System.getenv("DD_API_KEY");

        if (ddApiKey == null || ddApiKey.isEmpty()) {
            throw new RuntimeException("DD_API_KEY not set");
        }

        String serviceName = "InventoryService";
        String env = System.getenv("ENV") == null ? "dev" : System.getenv("ENV");
        String version = System.getenv("VERSION") == null ? "dev" : System.getenv("VERSION");

        ISecret ddApiKeySecret = new Secret(this, "DDApiKeySecret",
                SecretProps.builder()
                        .secretName(String.format("%s/%s/dd-api-key", env, serviceName))
                        .secretStringValue(new SecretValue(ddApiKey))
                        .build());

        SharedProps sharedProps = new SharedProps(serviceName, env, version, ddApiKeySecret);
        InventoryServiceProps serviceProps = new InventoryServiceProps(this, "InventoryServiceProps", sharedProps);

        var api = new InventoryApiContainer(this, "InventoryApi", new InventoryApiContainerProps(sharedProps, serviceProps.getSharedEventBus(), serviceProps.getJwtAccessKeyParameter()));

        var acl = new InventoryAcl(this, "InventoryACL", new InventoryAclProps(sharedProps, serviceProps.getPublisherEventBus(), serviceProps.getInventoryEventBus(), api.getTable()));

        new InventoryOrderingService(this, "InventoryOrdering", new InventoryOrderingServiceProps(sharedProps, api.getTable(), acl.getNewProductAddedTopic()));

        // Create forwarding rules for integration environments
        var integrationEnvironments = List.of("dev", "prod");
        if (integrationEnvironments.contains(env)) {
            var eventSubscriptions = List.of(
                    new OrderCreatedEvent(this, "SharedOrderCreatedEvent", sharedProps, serviceProps.getSharedEventBus()),
                    new OrderCompletedEvent(this, "SharedOrderCompletedEvent", sharedProps, serviceProps.getSharedEventBus()),
                    new ProductCreatedEvent(this, "SharedProductCreatedEvent", sharedProps, serviceProps.getSharedEventBus())
            );

            for (var event : eventSubscriptions) {
                event.addTarget(new software.amazon.awscdk.services.events.targets.EventBus(serviceProps.getInventoryEventBus()));
            }
        }
    }
}