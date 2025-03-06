package com.cdk;

import com.cdk.constructs.SharedProps;
import com.cdk.events.InventoryStockReservationFailedEvent;
import com.cdk.events.InventoryStockReservedEvent;
import com.cdk.events.InventoryStockUpdatedEvent;
import com.cdk.events.ProductOutOfStockEvent;
import com.cdk.inventory.acl.InventoryAcl;
import com.cdk.inventory.acl.InventoryAclProps;
import com.cdk.inventory.api.InventoryApiContainer;
import com.cdk.inventory.api.InventoryApiContainerProps;
import com.cdk.inventory.ordering.InventoryOrderingService;
import com.cdk.inventory.ordering.InventoryOrderingServiceProps;
import software.amazon.awscdk.Stack;
import software.amazon.awscdk.StackProps;
import software.amazon.awscdk.services.events.EventBus;
import software.amazon.awscdk.services.events.EventBusProps;
import software.amazon.awscdk.services.events.IEventBus;
import software.amazon.awscdk.services.secretsmanager.ISecret;
import software.amazon.awscdk.services.secretsmanager.Secret;
import software.amazon.awscdk.services.ssm.IStringParameter;
import software.amazon.awscdk.services.ssm.StringParameter;
import software.constructs.Construct;

import java.util.List;

public class InventoryServiceStack  extends Stack {

    public InventoryServiceStack(final Construct scope, final String id, final StackProps props) {
        super(scope, id, props);

        ISecret ddApiKeySecret = Secret.fromSecretCompleteArn(this, "DDApiKeySecret", System.getenv("DD_API_KEY_SECRET_ARN"));

        String serviceName = "InventoryService";
        String env = System.getenv("ENV") == null ? "dev" : System.getenv("ENV");
        String version = System.getenv("VERSION") == null ? "dev" : System.getenv("VERSION");

        SharedProps sharedProps = new SharedProps(serviceName, env, version, ddApiKeySecret);

        EventBus inventoryServiceEventBus = new EventBus(this, "InventoryServiceEventBus", EventBusProps.builder()
                .eventBusName(String.format("%s-bus-%s", serviceName, env))
                .build());

        IStringParameter jwtAccessKeyParameterName = StringParameter.fromStringParameterName(this, "JwtAccessKeyParameter", String.format("/%s/shared/secret-access-key", env));

        var api = new InventoryApiContainer(this, "InventoryApi", new InventoryApiContainerProps(sharedProps, inventoryServiceEventBus, jwtAccessKeyParameterName));

        var acl = new InventoryAcl(this, "InventoryACL", new InventoryAclProps(sharedProps, inventoryServiceEventBus, api.getTable()));

        new InventoryOrderingService(this, "InventoryOrdering", new InventoryOrderingServiceProps(sharedProps, api.getTable(), acl.getNewProductAddedTopic()));

        // Create forwarding rules for integration environments
        var integrationEnvironments = List.of("dev","prod");
        if (integrationEnvironments.contains(env)) {
            var publicEvents = List.of(
                    new InventoryStockReservedEvent(this, "InventoryStockReservedEvent", sharedProps, inventoryServiceEventBus),
                    new InventoryStockReservationFailedEvent(this, "InventoryStockReservationFailedEvent", sharedProps, inventoryServiceEventBus),
                    new ProductOutOfStockEvent(this, "ProductOutOfStockEvent", sharedProps, inventoryServiceEventBus),
                    new InventoryStockUpdatedEvent(this, "InventoryStockUpdatedEvent", sharedProps, inventoryServiceEventBus)
            );
            String eventBusName = StringParameter.valueForStringParameter(this, String.format("/%s/shared/event-bus-name", env));
            IEventBus sharedBus = EventBus.fromEventBusName(this, "SharedEventBus", eventBusName);

            for (var event : publicEvents) {
                event.addTarget(new software.amazon.awscdk.services.events.targets.EventBus(sharedBus));
            }
        }
    }
}