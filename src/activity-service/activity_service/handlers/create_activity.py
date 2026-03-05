from __future__ import annotations

import json
import os
from datetime import datetime, timezone
from typing import Any, Callable

from aws_lambda_powertools.utilities.batch import BatchProcessor, EventType, process_partial_response
from aws_lambda_powertools.utilities.batch.types import PartialItemFailureResponse
from aws_lambda_powertools.utilities.data_classes import SQSEvent
from aws_lambda_powertools.utilities.data_classes.sqs_event import SQSRecord
from aws_lambda_powertools.utilities.idempotency import idempotent_function
from aws_lambda_powertools.utilities.typing import LambdaContext
from ddtrace import tracer
from ddtrace._trace.context import Context
from ddtrace.data_streams import set_consume_checkpoint

from activity_service.dal import get_dal_handler
from activity_service.dal.db_handler import DalHandler
from activity_service.handlers.utils.idempotency import IDEMPOTENCY_CONFIG, IDEMPOTENCY_LAYER
from activity_service.handlers.utils.observability import logger
from activity_service.logic.create_activity_handler import create_activity_handler
from activity_service.models.input import CreateActivityRequest
from activity_service.models.public_events import (
    ORDER_COMPLETED_EVENT_NAME,
    ORDER_CONFIRMED_EVENT_NAME,
    ORDER_CREATED_EVENT_NAME,
    PRODUCT_CREATED_EVENT_NAME,
    PRODUCT_DELETED_EVENT_NAME,
    PRODUCT_UPDATED_EVENT_NAME,
    STOCK_RESERVATION_FAILED_EVENT_NAME,
    STOCK_RESERVED_EVENT_NAME,
    STOCK_UPDATED,
    USER_REGISTERED_EVENT_NAME,
)

tracer.set_tags({'domain': 'analytics', 'team': 'analytics'})

processor = BatchProcessor(event_type=EventType.SQS)

table_name = os.environ.get('TABLE_NAME', 'default-table')
dal_handler: DalHandler = get_dal_handler(table_name)


@logger.inject_lambda_context
def lambda_handler(event: SQSEvent, context: LambdaContext) -> PartialItemFailureResponse:
    """Process SQS messages containing EventBridge events with partial batch response support."""
    span = tracer.current_span()
    if span:
        span.set_tag('messaging.system', 'sqs')
        span.set_tag('messaging.operation.type', 'receive')

    return process_partial_response(
        event=event,
        record_handler=lambda record: process_message(record, context),
        processor=processor,
        context=context,
    )


def process_message(record: SQSRecord, lambda_context: LambdaContext) -> None:
    """Process an individual SQS record containing an EventBridge event."""
    try:
        message_body = json.loads(record.body)

        time = convert_date_time_string_to_epoch(message_body.get('time'))
        cloud_event_wrapper = message_body.get('detail', {})

        _set_data_streams_consume_checkpoint(cloud_event_wrapper)

        process_cloud_event(cloud_event_wrapper, time, lambda_context)

    except Exception as e:
        logger.exception(f'Error processing message: {e}')
        raise


def _set_data_streams_consume_checkpoint(cloud_event_wrapper: dict[str, Any]) -> None:
    """Set a Data Streams consume checkpoint extracting pathway context from the _datadog envelope."""
    carrier_get = extract_data_streams_carrier(cloud_event_wrapper)
    set_consume_checkpoint('eventbridge', cloud_event_wrapper.get('type'), carrier_get)


def extract_data_streams_carrier(cloud_event_wrapper: dict[str, Any]) -> Callable[[str], str | None]:
    """Return a carrier-get function that reads keys from the _datadog envelope."""
    datadog_envelope: dict[str, Any] = cloud_event_wrapper.get('_datadog', {}) or {}

    def carrier_get(key: str) -> str | None:
        return datadog_envelope.get(key)

    return carrier_get


def extract_trace_parent(cloud_event_wrapper: dict[str, Any]) -> str | None:
    """Extract traceparent, preferring _datadog.traceparent over top-level traceparent."""
    datadog_envelope: dict[str, Any] = cloud_event_wrapper.get('_datadog', {}) or {}
    datadog_traceparent: str | None = datadog_envelope.get('traceparent')
    if datadog_traceparent:
        return datadog_traceparent
    return cloud_event_wrapper.get('traceparent')


EventHandler = Callable[..., None]

_EVENT_HANDLER_REGISTRY: dict[str, EventHandler] | None = None


def _get_event_handler_registry() -> dict[str, EventHandler]:
    """Return the mapping of event type names to handler functions.

    Deferred initialisation ensures all handler functions are defined before
    the registry is built.
    """
    global _EVENT_HANDLER_REGISTRY
    if _EVENT_HANDLER_REGISTRY is None:
        _EVENT_HANDLER_REGISTRY = {
            PRODUCT_CREATED_EVENT_NAME: handle_product_created,
            PRODUCT_UPDATED_EVENT_NAME: handle_product_updated,
            PRODUCT_DELETED_EVENT_NAME: handle_product_deleted,
            USER_REGISTERED_EVENT_NAME: handle_user_registered,
            ORDER_CREATED_EVENT_NAME: handle_order_created,
            ORDER_CONFIRMED_EVENT_NAME: handle_order_confirmed,
            ORDER_COMPLETED_EVENT_NAME: handle_order_completed,
            STOCK_UPDATED: handle_stock_updated,
            STOCK_RESERVED_EVENT_NAME: handle_stock_reserved,
            STOCK_RESERVATION_FAILED_EVENT_NAME: handle_stock_reservation_failed,
        }
    return _EVENT_HANDLER_REGISTRY


def process_cloud_event(cloud_event_wrapper: dict[str, Any], time: int, lambda_context: LambdaContext) -> None:
    """Route a cloud event to the appropriate handler based on its type."""
    event_type: str | None = cloud_event_wrapper.get('type')
    event_data: dict[str, Any] = cloud_event_wrapper.get('data', {})
    event_id: str | None = cloud_event_wrapper.get('id')
    trace_parent = extract_trace_parent(cloud_event_wrapper)

    handler = _get_event_handler_registry().get(event_type or '')
    if handler is None:
        logger.error(f'Unhandled event_type: {event_type}')
        return

    handler(event_id=event_id, activity_type=event_type, detail=event_data, trace_parent=trace_parent, time=time)


@tracer.wrap(resource=f'process {PRODUCT_CREATED_EVENT_NAME}')
@idempotent_function(data_keyword_argument='event_id', persistence_store=IDEMPOTENCY_LAYER, config=IDEMPOTENCY_CONFIG)
def handle_product_created(
    event_id: str | None,
    activity_type: str,
    detail: dict[str, Any],
    trace_parent: str | None,
    time: int,
) -> None:
    """Handle product creation events."""
    _add_default_span_tags(event_id, PRODUCT_CREATED_EVENT_NAME, trace_parent)

    product_id = _require_field(detail, 'productId')

    create_activity_request = CreateActivityRequest(
        entityId=product_id,
        entityType='product',
        activityType=activity_type,
        activityTime=time,
    )
    span = tracer.current_span()
    if span:
        span.set_tag('product.id', product_id)

    create_activity_handler(create_activity_request, dal_handler)

    logger.info('Successfully processed product creation', product_id=product_id)


@tracer.wrap(resource=f'process {PRODUCT_UPDATED_EVENT_NAME}')
@idempotent_function(data_keyword_argument='event_id', persistence_store=IDEMPOTENCY_LAYER, config=IDEMPOTENCY_CONFIG)
def handle_product_updated(
    event_id: str | None,
    activity_type: str,
    detail: dict[str, Any],
    trace_parent: str | None,
    time: int,
) -> None:
    """Handle product update events."""
    _add_default_span_tags(event_id, PRODUCT_UPDATED_EVENT_NAME, trace_parent)

    product_id = _require_field(detail, 'productId')

    create_activity_request = CreateActivityRequest(
        entityId=product_id,
        entityType='product',
        activityType=activity_type,
        activityTime=time,
    )
    span = tracer.current_span()
    if span:
        span.set_tag('product.id', product_id)

    create_activity_handler(create_activity_request, dal_handler)

    logger.info('Successfully processed product update', product_id=product_id)


@tracer.wrap(resource=f'process {PRODUCT_DELETED_EVENT_NAME}')
@idempotent_function(data_keyword_argument='event_id', persistence_store=IDEMPOTENCY_LAYER, config=IDEMPOTENCY_CONFIG)
def handle_product_deleted(
    event_id: str | None,
    activity_type: str,
    detail: dict[str, Any],
    trace_parent: str | None,
    time: int,
) -> None:
    """Handle product deletion events."""
    _add_default_span_tags(event_id, PRODUCT_DELETED_EVENT_NAME, trace_parent)

    product_id = _require_field(detail, 'productId')

    create_activity_request = CreateActivityRequest(
        entityId=product_id,
        entityType='product',
        activityType=activity_type,
        activityTime=time,
    )
    span = tracer.current_span()
    if span:
        span.set_tag('product.id', product_id)

    create_activity_handler(create_activity_request, dal_handler)

    logger.info('Successfully processed product deletion', product_id=product_id)


@tracer.wrap(resource=f'process {USER_REGISTERED_EVENT_NAME}')
@idempotent_function(data_keyword_argument='event_id', persistence_store=IDEMPOTENCY_LAYER, config=IDEMPOTENCY_CONFIG)
def handle_user_registered(
    event_id: str | None,
    activity_type: str,
    detail: dict[str, Any],
    trace_parent: str | None,
    time: int,
) -> None:
    """Handle user registration events."""
    _add_default_span_tags(event_id, USER_REGISTERED_EVENT_NAME, trace_parent)

    user_id = _require_field(detail, 'userId')

    create_activity_request = CreateActivityRequest(
        entityId=user_id,
        entityType='user',
        activityType=activity_type,
        activityTime=time,
    )
    span = tracer.current_span()
    if span:
        span.set_tag('user.id', user_id)

    create_activity_handler(create_activity_request, dal_handler)


@tracer.wrap(resource=f'process {ORDER_CREATED_EVENT_NAME}')
@idempotent_function(data_keyword_argument='event_id', persistence_store=IDEMPOTENCY_LAYER, config=IDEMPOTENCY_CONFIG)
def handle_order_created(
    event_id: str | None,
    activity_type: str,
    detail: dict[str, Any],
    trace_parent: str | None,
    time: int,
) -> None:
    """Handle order creation events."""
    _add_default_span_tags(event_id, ORDER_CREATED_EVENT_NAME, trace_parent)

    order_number = _require_field(detail, 'orderNumber')

    create_order_activity_request = CreateActivityRequest(
        entityId=order_number,
        entityType='order',
        activityType=activity_type,
        activityTime=time,
    )
    span = tracer.current_span()
    if span:
        span.set_tag('order.number', order_number)

    create_activity_handler(create_order_activity_request, dal_handler)

    user_id: str | None = detail.get('userId')

    if not user_id:
        logger.warning('User ID not found in order creation event')
        return

    if span:
        span.set_tag('user.id', user_id)

    create_order_user_activity_request = CreateActivityRequest(
        entityId=user_id,
        entityType='user',
        activityType=activity_type,
        activityTime=time,
    )
    create_activity_handler(create_order_user_activity_request, dal_handler)


@tracer.wrap(resource=f'process {ORDER_CONFIRMED_EVENT_NAME}')
@idempotent_function(data_keyword_argument='event_id', persistence_store=IDEMPOTENCY_LAYER, config=IDEMPOTENCY_CONFIG)
def handle_order_confirmed(
    event_id: str | None,
    activity_type: str,
    detail: dict[str, Any],
    trace_parent: str | None,
    time: int,
) -> None:
    """Handle order confirmation events."""
    _add_default_span_tags(event_id, ORDER_CONFIRMED_EVENT_NAME, trace_parent)

    order_number = _require_field(detail, 'orderNumber')

    confirm_order_activity_request = CreateActivityRequest(
        entityId=order_number,
        entityType='order',
        activityType=activity_type,
        activityTime=time,
    )
    span = tracer.current_span()
    if span:
        span.set_tag('order.number', order_number)

    create_activity_handler(confirm_order_activity_request, dal_handler)

    user_id: str | None = detail.get('userId')

    if not user_id:
        logger.warning('User ID not found in order creation event')
        return

    if span:
        span.set_tag('user.id', user_id)

    confirm_order_user_activity_request = CreateActivityRequest(
        entityId=user_id,
        entityType='user',
        activityType=activity_type,
        activityTime=time,
    )
    create_activity_handler(confirm_order_user_activity_request, dal_handler)


@tracer.wrap(resource=f'process {ORDER_COMPLETED_EVENT_NAME}')
@idempotent_function(data_keyword_argument='event_id', persistence_store=IDEMPOTENCY_LAYER, config=IDEMPOTENCY_CONFIG)
def handle_order_completed(
    event_id: str | None,
    activity_type: str,
    detail: dict[str, Any],
    trace_parent: str | None,
    time: int,
) -> None:
    """Handle order completion events."""
    _add_default_span_tags(event_id, ORDER_COMPLETED_EVENT_NAME, trace_parent)

    order_number = _require_field(detail, 'orderNumber')

    order_activity_request = CreateActivityRequest(
        entityId=order_number,
        entityType='order',
        activityType=activity_type,
        activityTime=time,
    )
    span = tracer.current_span()
    if span:
        span.set_tag('order.number', order_number)

    create_activity_handler(order_activity_request, dal_handler)

    user_id: str | None = detail.get('userId')

    if not user_id:
        logger.warning('User ID not found in order creation event')
        return

    if span:
        span.set_tag('user.id', user_id)

    user_activity_request = CreateActivityRequest(
        entityId=user_id,
        entityType='user',
        activityType=activity_type,
        activityTime=time,
    )
    create_activity_handler(user_activity_request, dal_handler)


@tracer.wrap(resource=f'process {STOCK_UPDATED}')
@idempotent_function(data_keyword_argument='event_id', persistence_store=IDEMPOTENCY_LAYER, config=IDEMPOTENCY_CONFIG)
def handle_stock_updated(
    event_id: str | None,
    activity_type: str,
    detail: dict[str, Any],
    trace_parent: str | None,
    time: int,
) -> None:
    """Handle stock update events."""
    _add_default_span_tags(event_id, STOCK_UPDATED, trace_parent)

    product_id = _require_field(detail, 'productId')
    product_activity_request = CreateActivityRequest(
        entityId=product_id,
        entityType='product',
        activityType=activity_type,
        activityTime=time,
    )
    span = tracer.current_span()
    if span:
        span.set_tag('product.id', product_id)

    create_activity_handler(product_activity_request, dal_handler)


@tracer.wrap(resource=f'process {STOCK_RESERVED_EVENT_NAME}')
@idempotent_function(data_keyword_argument='event_id', persistence_store=IDEMPOTENCY_LAYER, config=IDEMPOTENCY_CONFIG)
def handle_stock_reserved(
    event_id: str | None,
    activity_type: str,
    detail: dict[str, Any],
    trace_parent: str | None,
    time: int,
) -> None:
    """Handle stock reservation events."""
    _add_default_span_tags(event_id, STOCK_RESERVED_EVENT_NAME, trace_parent)

    order_number = _require_field(detail, 'orderNumber')

    activity_request = CreateActivityRequest(
        entityId=order_number,
        entityType='order',
        activityType=activity_type,
        activityTime=time,
    )
    span = tracer.current_span()
    if span:
        span.set_tag('order.number', order_number)

    create_activity_handler(activity_request, dal_handler)


@tracer.wrap(resource=f'process {STOCK_RESERVATION_FAILED_EVENT_NAME}')
@idempotent_function(data_keyword_argument='event_id', persistence_store=IDEMPOTENCY_LAYER, config=IDEMPOTENCY_CONFIG)
def handle_stock_reservation_failed(
    event_id: str | None,
    activity_type: str,
    detail: dict[str, Any],
    trace_parent: str | None,
    time: int,
) -> None:
    """Handle stock reservation failure events."""
    _add_default_span_tags(event_id, STOCK_RESERVATION_FAILED_EVENT_NAME, trace_parent)

    order_number = _require_field(detail, 'orderNumber')

    activity_request = CreateActivityRequest(
        entityId=order_number,
        entityType='order',
        activityType=activity_type,
        activityTime=time,
    )
    span = tracer.current_span()
    if span:
        span.set_tag('order.number', order_number)

    create_activity_handler(activity_request, dal_handler)


def _require_field(detail: dict[str, Any], field_name: str) -> str:
    """Extract a required string field from a detail dict, raising ValueError if missing."""
    value: str | None = detail.get(field_name)
    if not value:
        raise ValueError(f"Required field '{field_name}' is missing or empty in event detail")
    return value


def _add_default_span_tags(event_id: str | None, event_type: str, trace_parent: str | None) -> None:
    """Add default span tags using the current span from tracer."""
    span = tracer.current_span()
    if not span:
        return

    span.set_tag('domain', 'activity')
    span.set_tag('team', 'activity')
    span.set_tag('messaging.message.eventType', 'public')
    span.set_tag('messaging.message.type', event_type)
    span.set_tag('messaging.message.id', event_id)
    span.set_tag('messaging.operation.type', 'process')
    span.set_tag('messaging.operation.name', 'process')
    span.set_tag('messaging.batch.message_count', 1)

    if not trace_parent:
        return

    span.set_tag('traceparent', trace_parent)
    trace_parent_parts = trace_parent.split('-')
    if len(trace_parent_parts) == 4:
        span.set_tag('traceparent.version', trace_parent_parts[0])
        span.set_tag('traceparent.trace_id', trace_parent_parts[1])
        span.set_tag('traceparent.span_id', trace_parent_parts[2])
        span.set_tag('traceparent.flags', trace_parent_parts[3])
        linked_context = Context(
            trace_id=int(trace_parent_parts[1], 16),
            span_id=int(trace_parent_parts[2], 16),
        )
        span.link_span(linked_context)


def convert_date_time_string_to_epoch(date_time_string: str) -> int:
    """Convert an ISO 8601 date-time string to epoch time in milliseconds.

    Handles both whole-second and fractional-second timestamps, with or
    without a trailing 'Z' UTC indicator. Fractional parts longer than
    6 digits (e.g. nanoseconds) are truncated to microseconds.
    """
    normalised = date_time_string.rstrip('Z')

    if '.' in normalised:
        base, frac = normalised.split('.', 1)
        normalised = f'{base}.{frac[:6]}'
        fmt = '%Y-%m-%dT%H:%M:%S.%f'
    else:
        fmt = '%Y-%m-%dT%H:%M:%S'

    dt = datetime.strptime(normalised, fmt).replace(tzinfo=timezone.utc)
    return int(dt.timestamp() * 1000)
