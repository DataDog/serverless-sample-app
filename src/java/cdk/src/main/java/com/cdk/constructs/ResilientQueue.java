/*
 * Unless explicitly stated otherwise all files in this repository are licensed under the Apache License Version 2.0.
 * This product includes software developed at Datadog (https://www.datadoghq.com/).
 * Copyright 2024 Datadog, Inc.
 */

package com.cdk.constructs;

import org.jetbrains.annotations.NotNull;
import software.amazon.awscdk.services.sqs.DeadLetterQueue;
import software.amazon.awscdk.services.sqs.IQueue;
import software.amazon.awscdk.services.sqs.Queue;
import software.amazon.awscdk.services.sqs.QueueProps;
import software.constructs.Construct;

public class ResilientQueue extends Construct {
    private final IQueue queue;
    private final IQueue dlq;
    public ResilientQueue(@NotNull Construct scope, @NotNull String id, @NotNull ResilientQueueProps props) {
        super(scope, id);
        
        this.dlq = new Queue(this, String.format("%sDLQ-%s", props.queueName(), props.props().env()), QueueProps.builder()
                .queueName(String.format("%sDLQ-%s", props.queueName(), props.props().env()))
                .build());

        this.queue = new Queue(this, String.format("%s-%s", props.queueName(), props.props().env()), QueueProps.builder()
                .queueName(String.format("%s-%s", props.queueName(), props.props().env()))
                .deadLetterQueue(DeadLetterQueue.builder()
                        .queue(this.dlq)
                        .maxReceiveCount(3)
                        .build())
                .build());
    }

    public IQueue getQueue() {
        return queue;
    }
}
