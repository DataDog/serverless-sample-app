package com.orders;

import software.amazon.awscdk.services.events.IEventBus;

public class BackgroundWorkersProps {
    private final SharedProps sharedProps;
    private final IEventBus sharedEventBus;

    public BackgroundWorkersProps(SharedProps sharedProps, IEventBus sharedEventBus) {
        this.sharedProps = sharedProps;
        this.sharedEventBus = sharedEventBus;
    }

    public SharedProps getSharedProps() {
        return sharedProps;
    }

    public IEventBus getSharedEventBus() {
        return sharedEventBus;
    }
}
