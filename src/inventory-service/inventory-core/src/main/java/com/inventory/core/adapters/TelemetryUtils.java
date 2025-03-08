package com.inventory.core.adapters;

import io.opentracing.Span;
import io.opentracing.util.GlobalTracer;

import java.io.Serializable;

public class TelemetryUtils {
    public static<T> Span createProcessSpanFor(Span parentSpan, CloudEventWrapper<T> evtWrapper) {
        final Span processSpan = GlobalTracer.get()
                .buildSpan(String.format("process %s", evtWrapper.getType()))
                .asChildOf(parentSpan)
                .start();
        processSpan.setTag("messaging.message.id", evtWrapper.getId());
        processSpan.setTag("messaging.operation.type", "process");
        processSpan.setTag("messaging.system", "aws_sqs");

        return processSpan;
    }
}
