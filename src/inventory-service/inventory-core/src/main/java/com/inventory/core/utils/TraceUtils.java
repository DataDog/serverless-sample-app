package com.inventory.core.utils;

import com.inventory.core.adapters.CloudEventWrapper;
import io.opentelemetry.api.trace.*;
import io.opentelemetry.context.Context;
import org.slf4j.Logger;

public class TraceUtils {
    public static Span startChildSpanFromLambdaInvoke(Tracer tracer) {
        return tracer.spanBuilder("lambda invoke")
                .setParent(Context.current())
                .startSpan();
    }

    public static <T> SpanContext extractSpanContextFromMessage(CloudEventWrapper<T> evtWrapper, Logger logger) {
        var traceParent = evtWrapper.getTraceparent();

        if (traceParent != null && !traceParent.isEmpty()) {
            var parts = traceParent.split("-");

            if (parts.length == 4) {
                SpanContext upstreamContext = SpanContext.createFromRemoteParent(parts[1], parts[2], TraceFlags.fromByte(Byte.parseByte(parts[3], 16)), TraceState.getDefault());
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
