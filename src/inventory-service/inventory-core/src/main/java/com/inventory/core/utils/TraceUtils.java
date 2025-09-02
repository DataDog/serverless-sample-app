package com.inventory.core.utils;

import com.inventory.core.adapters.CloudEventWrapper;
import io.opentelemetry.api.trace.*;
import io.opentracing.util.GlobalTracer;
import org.slf4j.Logger;

public class TraceUtils {
    public static Span startChildSpanFromLambdaInvoke(Tracer tracer) {
        final io.opentracing.Span lambdaSpan = GlobalTracer.get().activeSpan();

        var lambdaSpanTraceId = lambdaSpan.context().toTraceId();
        var lambdaSpanSpanId = lambdaSpan.context().toSpanId();
        SpanContext lambdaContext = SpanContext.createFromRemoteParent(lambdaSpanTraceId, lambdaSpanSpanId, TraceFlags.getSampled(), TraceState.getDefault());

        Span span = tracer.spanBuilder("handleProductCreatedLambda")
                .setParent(io.opentelemetry.context.Context.current().with(Span.wrap(lambdaContext)))
                .startSpan();

        return span;
    }

    public static <T> SpanContext extractSpanContextFromMessage(CloudEventWrapper<T> evtWrapper, Logger logger) {
        var traceParent = evtWrapper.getTraceparent();

        if (traceParent != null && !traceParent.isEmpty()) {
            var parts = traceParent.split("-");

            if (parts.length == 4) {
                SpanContext upstreamContext = SpanContext.createFromRemoteParent(parts[1], parts[2], TraceFlags.getSampled(), TraceState.getDefault());
                if (!upstreamContext.isValid()) {
                    logger.warn("Upstream context is not valid, skipping link creation.");
                    return null;
                }
                else {
                    logger.info("Upstream context is valid, adding link");
                    return upstreamContext;
                }
            }
        }

        return null;
    }
}
