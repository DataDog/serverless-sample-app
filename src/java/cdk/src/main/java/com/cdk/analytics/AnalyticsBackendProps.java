package com.cdk.analytics;

import com.cdk.constructs.SharedProps;
import software.amazon.awscdk.services.events.IEventBus;

public record AnalyticsBackendProps(SharedProps sharedProps, IEventBus sharedEventBus) { }
