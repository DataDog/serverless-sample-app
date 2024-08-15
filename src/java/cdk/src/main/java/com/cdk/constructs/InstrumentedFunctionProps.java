package com.cdk.constructs;

import java.util.HashMap;

public record InstrumentedFunctionProps(SharedProps sharedProps, String packageName, String jarFile,
                                        String routingExpression, HashMap<String, String> environmentVariables) {
}
