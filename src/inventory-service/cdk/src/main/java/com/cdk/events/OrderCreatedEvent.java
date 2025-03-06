package com.cdk.events;

import com.cdk.constructs.SharedProps;
import org.jetbrains.annotations.NotNull;
import org.jetbrains.annotations.Nullable;
import software.amazon.awscdk.services.events.EventPattern;
import software.amazon.awscdk.services.events.IEventBus;
import software.amazon.awscdk.services.events.Rule;
import software.amazon.awscdk.services.events.RuleProps;
import software.constructs.Construct;

import java.util.List;

public class OrderCreatedEvent extends Rule {
    public OrderCreatedEvent(@NotNull Construct scope, @NotNull String id, @NotNull SharedProps sharedProps, @NotNull IEventBus eventBus) {
        super(scope, id, RuleProps.builder()
                .description("Rule for order created event")
                .eventBus(eventBus)
                .build());

        this.addEventPattern(EventPattern.builder()
                .detailType(List.of("orders.orderCreated.v1"))
                .source(List.of(String.format("%s.orders", sharedProps.env())))
                .build());
    }
}
