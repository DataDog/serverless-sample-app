import json
import os

from aws_lambda_powertools.utilities.batch import BatchProcessor, EventType, process_partial_response
from aws_lambda_powertools.utilities.batch.types import PartialItemFailureResponse
from aws_lambda_powertools.utilities.data_classes import SQSEvent
from aws_lambda_powertools.utilities.data_classes.sqs_event import SQSRecord
from aws_lambda_powertools.utilities.typing import LambdaContext
from ddtrace import tracer

from activity_service.dal import get_dal_handler
from activity_service.dal.db_handler import DalHandler
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

tracer.set_tags({"domain": "analytics", "team": "analytics"})

# Initialize batch processor for SQS events
processor = BatchProcessor(event_type=EventType.SQS)

table_name = os.environ.get("TABLE_NAME", "default-table")
# Database operations
dal_handler: DalHandler = get_dal_handler(table_name)

@logger.inject_lambda_context
def lambda_handler(event: SQSEvent, context: LambdaContext) -> PartialItemFailureResponse:
    """
    Process SQS messages containing EventBridge events with partial batch response support.
    """

    # Set up observability tags for the current span
    tracer.current_span().set_tag("messaging.system", "sqs")
    tracer.current_span().set_tag("messaging.operation.type", "receive")

    return process_partial_response(
        event=event,
        record_handler=lambda record: process_message(record, context),
        processor=processor,
        context=context,
    )

def process_message(record: SQSRecord, lambda_context: LambdaContext) -> None:
    """Process an individual SQS record containing an EventBridge event"""
    try:
        # Parse the message body
        message_body = json.loads(record.body)

        # Extract EventBridge information
        time = convert_date_time_string_to_epoch(message_body.get("time"))
        cloud_event_wrapper = message_body.get("detail", {})

        process_cloud_event(cloud_event_wrapper, time, lambda_context)


    except Exception as e:
        logger.exception(f"Error processing message: {e}")
        # Re-raising the exception marks this specific record as failed
        # while allowing other records to be processed successfully
        raise

def process_cloud_event(cloud_event_wrapper: dict, time: int, lambda_context: LambdaContext) -> None:
    event_type = cloud_event_wrapper.get("type")
    event_data = cloud_event_wrapper.get("data")
    event_id = cloud_event_wrapper.get("id")

    if type == PRODUCT_CREATED_EVENT_NAME:
        handle_product_created(event_id, event_type, event_data, time)
    elif type == PRODUCT_UPDATED_EVENT_NAME:
        handle_product_updated(event_id, event_type, event_data, time)
    elif type == PRODUCT_DELETED_EVENT_NAME:
        handle_product_deleted(event_id, event_type, event_data, time)
    elif type == USER_REGISTERED_EVENT_NAME:
        handle_user_registered(event_id, event_type, event_data, time)
    elif type == ORDER_CREATED_EVENT_NAME:
        handle_order_created(event_id, event_type, event_data, time)
    elif type == ORDER_CONFIRMED_EVENT_NAME:
        handle_order_confirmed(event_id, event_type, event_data, time)
    elif type == ORDER_COMPLETED_EVENT_NAME:
        handle_order_completed(event_id, event_type, event_data, time)
    elif type == STOCK_UPDATED:
        handle_stock_updated(event_id, event_type, event_data, time)
    elif type == STOCK_RESERVED_EVENT_NAME:
        handle_stock_reserved(event_id, event_type, event_data, time)
    elif type == STOCK_RESERVATION_FAILED_EVENT_NAME:
        handle_stock_reservation_failed(event_id, event_type, event_data, time)
    else:
        logger.error(f"Unhandled event_type: {event_type}")

def handle_product_created(event_id: str, activity_type: str, detail: dict, time: int) -> None:
    with tracer.trace(f"process {PRODUCT_CREATED_EVENT_NAME}") as span:
        """Handle product creation events"""
        _add_default_span_tags(span, event_id, PRODUCT_CREATED_EVENT_NAME)

        product_id = detail.get("productId")

        create_activity_request: CreateActivityRequest = CreateActivityRequest(
            entityId=product_id,
            entityType="product",
            activityType=activity_type,
            activityTime=time,
        )
        tracer.current_span().set_tag("product.id", product_id)

        create_activity_handler(create_activity_request, dal_handler)

        logger.info("Successfully processed product creation", product_id=detail.get("productId"))


@tracer.wrap(resource=f"process {PRODUCT_UPDATED_EVENT_NAME}")
def handle_product_updated(event_id: str, activity_type: str, detail: dict,time: int) -> None:
    """Handle product update events"""
    _add_default_span_tags(event_id, PRODUCT_UPDATED_EVENT_NAME)

    product_id = detail.get("productId")

    create_activity_request: CreateActivityRequest = CreateActivityRequest(
        entityId=product_id,
        entityType="product",
        activityType=activity_type,
        activityTime=time,
    )
    tracer.current_span().set_tag("product.id", product_id)

    # Database operations
    dal_handler: DalHandler = get_dal_handler(table_name)

    create_activity_handler(create_activity_request, dal_handler)

    logger.info("Successfully processed product update", product_id=detail.get("productId"))


@tracer.wrap(resource=f"process {PRODUCT_DELETED_EVENT_NAME}")
def handle_product_deleted(event_id: str, activity_type: str, detail: dict,time: int) -> None:
    """Handle product update events"""
    _add_default_span_tags(event_id, PRODUCT_DELETED_EVENT_NAME)

    product_id = detail.get("productId")

    create_activity_request: CreateActivityRequest = CreateActivityRequest(
        entityId=product_id,
        entityType="product",
        activityType=activity_type,
        activityTime=time,
    )
    tracer.current_span().set_tag("product.id", product_id)

    # Database operations
    dal_handler: DalHandler = get_dal_handler(table_name)

    create_activity_handler(create_activity_request, dal_handler)

    logger.info("Successfully processed product update", product_id=detail.get("productId"))

@tracer.wrap(resource=f"process {USER_REGISTERED_EVENT_NAME}")
def handle_user_registered(event_id: str, activity_type: str, detail: dict, time: int) -> None:
    _add_default_span_tags(event_id, USER_REGISTERED_EVENT_NAME)

    user_id = detail.get("userId")

    create_activity_request: CreateActivityRequest = CreateActivityRequest(
        entityId=user_id,
        entityType="user",
        activityType=activity_type,
        activityTime=time,
    )
    tracer.current_span().set_tag("user.id", user_id)

    create_activity_handler(create_activity_request, dal_handler)


@tracer.wrap(resource=f"process {ORDER_CREATED_EVENT_NAME}")
def handle_order_created(event_id: str, activity_type: str, detail: dict,time: int) -> None:
    _add_default_span_tags(event_id, ORDER_CREATED_EVENT_NAME)

    order_number = detail.get("orderNumber")

    create_order_activity_request: CreateActivityRequest = CreateActivityRequest(
        entityId=order_number,
        entityType="order",
        activityType=activity_type,
        activityTime=time,
    )
    tracer.current_span().set_tag("order.number", order_number)
    create_activity_handler(create_order_activity_request, dal_handler)

    user_id = detail.get("userId")

    if not user_id:
        logger.warning("User ID not found in order creation event")
        return

    tracer.current_span().set_tag("user.id", user_id)

    create_order_user_activity_request: CreateActivityRequest = CreateActivityRequest(
        entityId=detail.get("userId"),
        entityType="user",
        activityType=activity_type,
        activityTime=time,
    )
    create_activity_handler(create_order_user_activity_request, dal_handler)


@tracer.wrap(resource=f"process {ORDER_CONFIRMED_EVENT_NAME}")
def handle_order_confirmed(event_id: str, activity_type: str, detail: dict,time: int) -> None:
    _add_default_span_tags(event_id, ORDER_CONFIRMED_EVENT_NAME)

    order_number = detail.get("orderNumber")

    confirm_order_activity_request: CreateActivityRequest = CreateActivityRequest(
        entityId=order_number,
        entityType="order",
        activityType=activity_type,
        activityTime=time,
    )
    tracer.current_span().set_tag("order.number", order_number)
    create_activity_handler(confirm_order_activity_request, dal_handler)

    user_id = detail.get("userId")

    if not user_id:
        logger.warning("User ID not found in order creation event")
        return

    tracer.current_span().set_tag("user.id", user_id)

    confirm_order_user_activity_request: CreateActivityRequest = CreateActivityRequest(
        entityId=detail.get("userId"),
        entityType="user",
        activityType=activity_type,
        activityTime=time,
    )
    create_activity_handler(confirm_order_user_activity_request, dal_handler)

@tracer.wrap(resource=f"process {ORDER_COMPLETED_EVENT_NAME}")
def handle_order_completed(event_id: str, activity_type: str, detail: dict,time: int) -> None:
    _add_default_span_tags(event_id, ORDER_COMPLETED_EVENT_NAME)

    order_number = detail.get("orderNumber")

    order_activity_request: CreateActivityRequest = CreateActivityRequest(
        entityId=order_number,
        entityType="order",
        activityType=activity_type,
        activityTime=time,
    )
    tracer.current_span().set_tag("order.number", order_number)
    create_activity_handler(order_activity_request, dal_handler)

    user_id = detail.get("userId")

    if not user_id:
        logger.warning("User ID not found in order creation event")
        return

    tracer.current_span().set_tag("user.id", user_id)

    user_activity_request: CreateActivityRequest = CreateActivityRequest(
        entityId=detail.get("userId"),
        entityType="user",
        activityType=activity_type,
        activityTime=time,
    )
    create_activity_handler(user_activity_request, dal_handler)

@tracer.wrap(resource=f"process {STOCK_UPDATED}")
def handle_stock_updated(event_id: str, activity_type: str, detail: dict,time: int) -> None:
    _add_default_span_tags(event_id, STOCK_UPDATED)

    product_id = detail.get("productId")
    product_activity_request: CreateActivityRequest = CreateActivityRequest(
        entityId=product_id,
        entityType="product",
        activityType=activity_type,
        activityTime=time,
    )
    tracer.current_span().set_tag("product.id", product_id)
    create_activity_handler(product_activity_request, dal_handler)

@tracer.wrap(resource=f"process {STOCK_RESERVED_EVENT_NAME}")
def handle_stock_reserved(event_id: str, activity_type: str, detail: dict,time: int) -> None:
    _add_default_span_tags(event_id, STOCK_RESERVED_EVENT_NAME)

    order_number = detail.get("orderNumber")

    activity_request: CreateActivityRequest = CreateActivityRequest(
        entityId=order_number,
        entityType="order",
        activityType=activity_type,
        activityTime=time,
    )
    tracer.current_span().set_tag("order.number", order_number)
    create_activity_handler(activity_request, dal_handler)

@tracer.wrap(resource=f"process {STOCK_RESERVATION_FAILED_EVENT_NAME}")
def handle_stock_reservation_failed(event_id: str, activity_type: str, detail: dict,time: int) -> None:
    _add_default_span_tags(event_id, STOCK_RESERVATION_FAILED_EVENT_NAME)

    order_number = detail.get("orderNumber")

    activity_request: CreateActivityRequest = CreateActivityRequest(
        entityId=order_number,
        entityType="order",
        activityType=activity_type,
        activityTime=time,
    )
    tracer.current_span().set_tag("order.number", order_number)
    create_activity_handler(activity_request, dal_handler)

def _add_default_span_tags(span: Span, event_id: str, event_type: str) -> None:
    span.set_tag("domain", "activity")
    span.set_tag("team", "activity")
    span.set_tag("messaging.message.eventType", "public")
    span.set_tag("messaging.message.type", event_type)
    span.set_tag("messaging.message.id", event_id)
    span.set_tag("messaging.operation.type", "process")
    span.set_tag("messaging.operation.name", "process")
    span.set_tag("messaging.batch.message_count", 1)

def convert_date_time_string_to_epoch(date_time_string: str) -> int:
    """
    Convert a date time string to epoch time in milliseconds.
    This is a placeholder function; actual implementation may vary.
    """
    from datetime import datetime
    dt = datetime.strptime(date_time_string, "%Y-%m-%dT%H:%M:%SZ")
    return int(dt.timestamp() * 1000)  # Convert to milliseconds
