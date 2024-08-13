package com.orders;

import com.orders.constructs.InstrumentedFunction;
import com.orders.constructs.InstrumentedFunctionProps;
import org.jetbrains.annotations.NotNull;
import software.amazon.awscdk.services.lambda.IFunction;
import software.amazon.awscdk.services.lambda.eventsources.SqsEventSource;
import software.amazon.awscdk.services.sqs.DeadLetterQueue;
import software.amazon.awscdk.services.sqs.IQueue;
import software.amazon.awscdk.services.sqs.Queue;
import software.amazon.awscdk.services.sqs.QueueProps;
import software.constructs.Construct;

import java.util.HashMap;

public class BackgroundWorkers extends Construct {
    private final IFunction snsConsumerFunction;
    private final IFunction snsToSqsConsumerFunction;
    private final IFunction eventBridgeConsumerFunction;
    private final IFunction eventBridgeToSqsConsumerFunction;
    private final IQueue snsConsumerQueue;
    private final IQueue eventBridgeConsumerQueue;
    
    public BackgroundWorkers(@NotNull Construct scope, @NotNull String id, @NotNull BackgroundWorkersProps props) {
        super(scope, id);
        
        HashMap<String, String> backgroundEnvironmentVariables = new HashMap<>();
        backgroundEnvironmentVariables.put("EVENT_BUS_NAME", props.getSharedEventBus().getEventBusName());

        this.snsConsumerFunction = new InstrumentedFunction(this, "SnsConsumerJavaFunction",
                new InstrumentedFunctionProps(props.getSharedProps(), "handleSnsMessage", backgroundEnvironmentVariables)).getAlias();

        IQueue snsConsumerDLQ = new Queue(this, "SnsConsumerJavaDLQ");
        
        this.snsConsumerQueue = new Queue(this, "SnsConsumerJavaQueue", QueueProps.builder()
                .deadLetterQueue(DeadLetterQueue.builder()
                        .maxReceiveCount(3)
                        .queue(snsConsumerDLQ)
                        .build())
                .build());
        
        this.snsToSqsConsumerFunction = new InstrumentedFunction(this, "SnsToSqsConsumerJavaFunction",
                new InstrumentedFunctionProps(props.getSharedProps(), "handleSnsToSqsMessage", backgroundEnvironmentVariables)).getAlias();
        this.snsToSqsConsumerFunction.addEventSource(new SqsEventSource(this.snsConsumerQueue));
        props.getSharedEventBus().grantPutEventsTo(this.snsToSqsConsumerFunction);

        this.eventBridgeConsumerFunction = new InstrumentedFunction(this, "EventBridgeConsumerJavaFunction",
                new InstrumentedFunctionProps(props.getSharedProps(), "handleEventBridgeEvent", backgroundEnvironmentVariables)).getAlias();

        IQueue eventBridgeConsumerDLQ = new Queue(this, "EventBridgeConsumerJavaDLQ");

        this.eventBridgeConsumerQueue = new Queue(this, "EventBridgeConsumerJavaQueue", QueueProps.builder()
                .deadLetterQueue(DeadLetterQueue.builder()
                        .maxReceiveCount(3)
                        .queue(eventBridgeConsumerDLQ)
                        .build())
                .build());

        this.eventBridgeToSqsConsumerFunction = new InstrumentedFunction(this, "EventBridgeToSqsJavaFunction",
                new InstrumentedFunctionProps(props.getSharedProps(), "handleEventBridgeToSqsEvent", backgroundEnvironmentVariables)).getAlias();
        this.eventBridgeToSqsConsumerFunction.addEventSource(new SqsEventSource(this.eventBridgeConsumerQueue));
    }

    public IQueue getSnsConsumerQueue() {
        return snsConsumerQueue;
    }

    public IQueue getEventBridgeConsumerQueue() {
        return eventBridgeConsumerQueue;
    }

    public IFunction getSnsConsumerFunction(){
        return snsConsumerFunction;
    }

    public IFunction getSnsToSqsConsumerFunction() {
        return snsToSqsConsumerFunction;
    }

    public IFunction getEventBridgeConsumerFunction() {
        return eventBridgeConsumerFunction;
    }
    
    public IFunction getEventBridgeToSqsConsumerFunction() {
        return this.eventBridgeToSqsConsumerFunction;
    }
}
