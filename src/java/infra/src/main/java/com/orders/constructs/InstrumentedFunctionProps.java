package com.orders.constructs;

import com.orders.SharedProps;

import java.util.HashMap;

public class InstrumentedFunctionProps {
    private final SharedProps sharedProps;
    private final String routingExpression;
    private final HashMap<String, String> environmentVariables;

    public InstrumentedFunctionProps(SharedProps sharedProps, String routingExpression, HashMap<String, String> environmentVariables) {
        this.sharedProps = sharedProps;
        this.routingExpression = routingExpression;
        this.environmentVariables = environmentVariables;
    }

    public HashMap<String, String> getEnvironmentVariables() {
        return environmentVariables;
    }

    public SharedProps getSharedProps() {
        return sharedProps;
    }

    public String getRoutingExpression() {
        return routingExpression;
    }
}
