package com.cdk.constructs;

public class ResiliantQueueProps {
    private final String queueName;
    private final SharedProps props;

    public ResiliantQueueProps(String queueName, SharedProps props) {
        this.queueName = queueName;
        this.props = props;
    }

    public String getQueueName() {
        return queueName;
    }

    public SharedProps getProps() {
        return props;
    }
}
