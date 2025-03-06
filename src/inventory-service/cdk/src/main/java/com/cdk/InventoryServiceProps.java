package com.cdk;

import com.cdk.constructs.SharedProps;
import org.jetbrains.annotations.NotNull;
import software.amazon.awscdk.services.events.EventBus;
import software.amazon.awscdk.services.events.EventBusProps;
import software.amazon.awscdk.services.events.IEventBus;
import software.amazon.awscdk.services.ssm.IStringParameter;
import software.amazon.awscdk.services.ssm.StringParameter;
import software.amazon.awscdk.services.ssm.StringParameterProps;
import software.constructs.Construct;

import java.util.List;

public class InventoryServiceProps extends Construct {
    private final IEventBus inventoryEventBus;
    private IEventBus sharedEventBus;
    private IStringParameter jwtAccessKeyParameter;
    private List<String> integrationEnvironments = List.of("dev","prod");

    public InventoryServiceProps(@NotNull Construct scope, @NotNull String id, SharedProps sharedProps) {
        super(scope, id);

        this.inventoryEventBus = new EventBus(this, "InventoryServiceEventBus", EventBusProps.builder()
                .eventBusName(String.format("%s-bus-%s", sharedProps.service(), sharedProps.env()))
                .build());
        var inventoryEventBusParameter = new StringParameter(this, "InventoryEventBusNameParameter", StringParameterProps.builder()
                .parameterName(String.format("/%s/%s/event-bus-name", sharedProps.env(), sharedProps.service()))
                .stringValue(inventoryEventBus.getEventBusName())
                .build());
        var inventoryEventBusArnParameter = new StringParameter(this, "InventoryEventBusArnParameter", StringParameterProps.builder()
                .parameterName(String.format("/%s/%s/event-bus-arn", sharedProps.env(), sharedProps.service()))
                .stringValue(inventoryEventBus.getEventBusArn())
                .build());

        if (integrationEnvironments.contains(sharedProps.env())) {
            String eventBusName = StringParameter.valueForStringParameter(this, String.format("/%s/shared/event-bus-name", sharedProps.env()));
            this.sharedEventBus = EventBus.fromEventBusName(this, "SharedEventBus", eventBusName);

            this.jwtAccessKeyParameter = StringParameter.fromStringParameterName(this, "JwtAccessKeyParameter", String.format("/%s/shared/secret-access-key", sharedProps.env()));
        } else {
            this.jwtAccessKeyParameter = new StringParameter(this, "InventoryJWTAccessKeyParameter", StringParameterProps.builder()
                    .parameterName(String.format("/%s/%s/secret-access-key", sharedProps.env(), sharedProps.service()))
                    .stringValue("This is a sample secret key that should not be used in production`")
                    .build());
        }
    }

    public IEventBus getInventoryEventBus() {
        return inventoryEventBus;
    }

    public IEventBus getSharedEventBus() {
        return sharedEventBus;
    }

    public IStringParameter getJwtAccessKeyParameter() {
        return jwtAccessKeyParameter;
    }

    public List<String> getIntegrationEnvironments() {
        return integrationEnvironments;
    }
}
