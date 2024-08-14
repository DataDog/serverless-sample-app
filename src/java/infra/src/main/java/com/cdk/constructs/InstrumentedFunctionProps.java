package com.cdk.constructs;

import java.util.HashMap;

public class InstrumentedFunctionProps {
    private final String packageName;
    private final String jarFile;
    private final SharedProps sharedProps;
    private final String routingExpression;
    private final HashMap<String, String> environmentVariables;

    public InstrumentedFunctionProps(SharedProps sharedProps, String packageName, String jarFile, String routingExpression, HashMap<String, String> environmentVariables) {
        this.sharedProps = sharedProps;
        this.packageName = packageName;
        this.jarFile = jarFile;
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

    public String getJarFile() {
        return jarFile;
    }

    public String getPackageName() {
        return packageName;
    }
}
