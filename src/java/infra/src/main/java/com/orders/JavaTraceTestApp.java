package com.orders;

import software.amazon.awscdk.App;
import software.amazon.awscdk.StackProps;

public class JavaTraceTestApp {
    public static void main(final String[] args) {
        App app = new App();

        new JavaTraceTestStack(app, "JavaTraceTestStack", StackProps.builder()
                .build());

        app.synth();
    }
}

