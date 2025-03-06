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

public class InventoryStockReservedEvent extends Rule {
    public InventoryStockReservedEvent(@NotNull Construct scope, @NotNull String id, @NotNull SharedProps sharedProps, @NotNull IEventBus inventoryServiceEventBus) {
        super(scope, id, RuleProps.builder()
                .eventBus(inventoryServiceEventBus)
                .build());

        this.addEventPattern(EventPattern.builder()
                .detailType(List.of("inventory.stockReserved.v1"))
                .source(List.of(String.format("%s.inventory", sharedProps.env())))
                .build());
    }
}
