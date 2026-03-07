from __future__ import annotations

from ddtrace import tracer
from ddtrace._trace.context import Context
from ddtrace.data_streams import set_consume_checkpoint


def add_messaging_span_tags(
    event_type: str,
    event_id: str | None,
    trace_parent: str | None,
    domain: str = "product-search",
) -> None:
    """Add OTel messaging semantic convention tags and a span link from traceparent.

    Args:
        event_type: The cloud event type string (e.g. ``product.created``).
        event_id: The cloud event unique identifier.
        trace_parent: W3C traceparent header value, if available.
        domain: The service domain tag value. Defaults to ``product-search``.
    """
    span = tracer.current_span()
    if not span:
        return

    span.set_tag("domain", domain)
    span.set_tag("team", "product-search")
    span.set_tag("messaging.message.eventType", "public")
    span.set_tag("messaging.message.type", event_type)
    span.set_tag("messaging.message.id", event_id)
    span.set_tag("messaging.operation.type", "process")
    span.set_tag("messaging.operation.name", "process")
    span.set_tag("messaging.batch.message_count", 1)
    span.set_tag("messaging.system", "aws_sqs")

    if not trace_parent:
        return

    parts = trace_parent.split("-")
    if len(parts) != 4:
        return

    span.set_tag("traceparent", trace_parent)
    span.set_tag("traceparent.version", parts[0])
    span.set_tag("traceparent.trace_id", parts[1])
    span.set_tag("traceparent.span_id", parts[2])
    span.set_tag("traceparent.flags", parts[3])

    try:
        linked_context = Context(
            trace_id=int(parts[1], 16),
            span_id=int(parts[2], 16),
            is_remote=True,  # Required for correct span link rendering in Datadog UI
        )
    except ValueError:
        return
    span.link_span(linked_context)


def set_dsm_consume_checkpoint(event_type: str, cloud_event: dict) -> None:
    """Set a Data Streams Monitoring consume checkpoint for an EventBridge event.

    Args:
        event_type: The cloud event type string used as the DSM stream name.
        cloud_event: The full cloud event dict, which may contain a ``_datadog``
            envelope with pathway context.
    """
    datadog_envelope: dict = cloud_event.get("_datadog", {}) or {}

    def carrier_get(key: str) -> str | None:
        return datadog_envelope.get(key)

    set_consume_checkpoint("eventbridge", event_type, carrier_get)


def extract_trace_parent(cloud_event: dict) -> str | None:
    """Extract traceparent from a cloud event.

    Prefers the value nested inside the ``_datadog`` envelope over a top-level
    ``traceparent`` key, matching the propagation convention used by the
    Datadog EventBridge integration.

    Args:
        cloud_event: The full cloud event dict.

    Returns:
        The traceparent string, or ``None`` if not present.
    """
    datadog_envelope: dict = cloud_event.get("_datadog", {}) or {}
    return datadog_envelope.get("traceparent") or cloud_event.get("traceparent")
