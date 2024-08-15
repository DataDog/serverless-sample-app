package com.cdk.constructs;

import org.jetbrains.annotations.NotNull;
import software.amazon.awscdk.services.sqs.DeadLetterQueue;
import software.amazon.awscdk.services.sqs.IQueue;
import software.amazon.awscdk.services.sqs.Queue;
import software.amazon.awscdk.services.sqs.QueueProps;
import software.constructs.Construct;

public class ResiliantQueue extends Construct {
    private final IQueue queue;
    private final IQueue dlq;
    public ResiliantQueue(@NotNull Construct scope, @NotNull String id, @NotNull ResiliantQueueProps props) {
        super(scope, id);
        
        this.dlq = new Queue(this, String.format("%sDLQ-%s", props.getQueueName(), props.getProps().getEnv()), QueueProps.builder()
                .queueName(String.format("%sDLQ-%s", props.getQueueName(), props.getProps().getEnv()))
                .build());

        this.queue = new Queue(this, String.format("%s-%s", props.getQueueName(), props.getProps().getEnv()), QueueProps.builder()
                .queueName(String.format("%s-%s", props.getQueueName(), props.getProps().getEnv()))
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
