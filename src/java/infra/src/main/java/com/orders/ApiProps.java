package com.orders;

public class ApiProps {
    private final SharedProps sharedProps;

    public ApiProps(SharedProps sharedProps) {
        this.sharedProps = sharedProps;
    }

    public SharedProps getSharedProps() {
        return sharedProps;
    }
}
