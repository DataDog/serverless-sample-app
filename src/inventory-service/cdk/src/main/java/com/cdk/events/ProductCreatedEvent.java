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

public class ProductCreatedEvent extends Rule {
    public ProductCreatedEvent(@NotNull Construct scope, @NotNull String id, @NotNull SharedProps sharedProps, @NotNull IEventBus eventBus) {
        super(scope, id, RuleProps.builder()
                .description("Rule for the product created event")
                .eventBus(eventBus)
                .build());

        this.addEventPattern(EventPattern.builder()
                .detailType(List.of("product.productCreated.v1"))
                .source(List.of(String.format("%s.products", sharedProps.env())))
                .build());
    }
}
