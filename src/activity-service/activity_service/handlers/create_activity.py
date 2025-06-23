import json
import os

from aws_lambda_powertools.utilities.batch import BatchProcessor, EventType, process_partial_response
from aws_lambda_powertools.utilities.batch.types import PartialItemFailureResponse
from aws_lambda_powertools.utilities.data_classes import SQSEvent
from aws_lambda_powertools.utilities.data_classes.sqs_event import SQSRecord
from aws_lambda_powertools.utilities.typing import LambdaContext

from activity_service.dal import get_dal_handler
from activity_service.dal.db_handler import DalHandler
from activity_service.handlers.utils.observability import logger, tracer
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

# Initialize batch processor for SQS events
processor = BatchProcessor(event_type=EventType.SQS)

table_name = os.environ.get("TABLE_NAME", "default-table")
# Database operations
dal_handler: DalHandler = get_dal_handler(table_name)

@logger.inject_lambda_context
@tracer.capture_lambda_handler
def lambda_handler(event: SQSEvent, context: LambdaContext) -> PartialItemFailureResponse:
    """
    Process SQS messages containing EventBridge events with partial batch response support.
    """
    return process_partial_response(
        event=event,
        record_handler=lambda record: process_message(record, context),
        processor=processor,
        context=context,
    )


def get_table_name() -> str:
    """Get the table name from environment variables"""
    return


@tracer.capture_method
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
    type = cloud_event_wrapper.get("type")
    event_data = cloud_event_wrapper.get("data")

    logger.info(f"Remaining time: {lambda_context.get_remaining_time_in_millis()}")
    logger.info(f"Processing event with type: {type}")

    if type == PRODUCT_CREATED_EVENT_NAME:
        handle_product_created(type, event_data, time)
    elif type == PRODUCT_UPDATED_EVENT_NAME:
        handle_product_updated(type, event_data, time)
    elif type == PRODUCT_DELETED_EVENT_NAME:
        handle_product_deleted(type, event_data, time)
    elif type == USER_REGISTERED_EVENT_NAME:
        handle_user_registered(type, event_data, time)
    elif type == ORDER_CREATED_EVENT_NAME:
        handle_order_created(type, event_data, time)
    elif type == ORDER_CONFIRMED_EVENT_NAME:
        handle_order_confirmed(type, event_data, time)
    elif type == ORDER_COMPLETED_EVENT_NAME:
        handle_order_completed(type, event_data, time)
    elif type == STOCK_UPDATED:
        handle_stock_updated(type, event_data, time)
    elif type == STOCK_RESERVED_EVENT_NAME:
        handle_stock_reserved(type, event_data, time)
    elif type == STOCK_RESERVATION_FAILED_EVENT_NAME:
        handle_stock_reservation_failed(type, event_data, time)
    else:
        logger.error(f"Unhandled detail-type: {type}")

@tracer.capture_method
def handle_product_created(activity_type: str, detail: dict, time: int) -> None:
    """Handle product creation events"""
    logger.info("Processing product creation", product_id=detail.get("productId"))

    create_activity_request: CreateActivityRequest = CreateActivityRequest(
        entityId=detail.get("productId"),
        entityType="product",
        activityType=activity_type,
        activityTime=time,
    )

    create_activity_handler(create_activity_request, dal_handler)

    logger.info("Successfully processed product creation", product_id=detail.get("productId"))


@tracer.capture_method
def handle_product_updated(activity_type: str, detail: dict,time: int) -> None:
    """Handle product update events"""
    logger.info("Processing product update", product_id=detail.get("productId"))

    create_activity_request: CreateActivityRequest = CreateActivityRequest(
        entityId=detail.get("productId"),
        entityType="product",
        activityType=activity_type,
        activityTime=time,
    )

    # Database operations
    dal_handler: DalHandler = get_dal_handler(table_name)

    create_activity_handler(create_activity_request, dal_handler)

    logger.info("Successfully processed product update", product_id=detail.get("productId"))


@tracer.capture_method
def handle_product_deleted(activity_type: str, detail: dict,time: int) -> None:
    """Handle product update events"""
    logger.info("Processing product delete", product_id=detail.get("productId"))

    create_activity_request: CreateActivityRequest = CreateActivityRequest(
        entityId=detail.get("productId"),
        entityType="product",
        activityType=activity_type,
        activityTime=time,
    )

    # Database operations
    dal_handler: DalHandler = get_dal_handler(table_name)

    create_activity_handler(create_activity_request, dal_handler)

    logger.info("Successfully processed product update", product_id=detail.get("productId"))

@tracer.capture_method
def handle_user_registered(activity_type: str, detail: dict, time: int) -> None:
    create_activity_request: CreateActivityRequest = CreateActivityRequest(
        entityId=detail.get("userId"),
        entityType="user",
        activityType=activity_type,
        activityTime=time,
    )

    create_activity_handler(create_activity_request, dal_handler)


@tracer.capture_method
def handle_order_created(activity_type: str, detail: dict,time: int) -> None:
    create_order_activity_request: CreateActivityRequest = CreateActivityRequest(
        entityId=detail.get("orderNumber"),
        entityType="order",
        activityType=activity_type,
        activityTime=time,
    )
    create_activity_handler(create_order_activity_request, dal_handler)

    create_order_user_activity_request: CreateActivityRequest = CreateActivityRequest(
        entityId=detail.get("userId"),
        entityType="user",
        activityType=activity_type,
        activityTime=time,
    )
    create_activity_handler(create_order_user_activity_request, dal_handler)


@tracer.capture_method
def handle_order_confirmed(activity_type: str, detail: dict,time: int) -> None:
    confirm_order_activity_request: CreateActivityRequest = CreateActivityRequest(
        entityId=detail.get("orderNumber"),
        entityType="order",
        activityType=activity_type,
        activityTime=time,
    )
    create_activity_handler(confirm_order_activity_request, dal_handler)

    confirm_order_user_activity_request: CreateActivityRequest = CreateActivityRequest(
        entityId=detail.get("userId"),
        entityType="user",
        activityType=activity_type,
        activityTime=time,
    )
    create_activity_handler(confirm_order_user_activity_request, dal_handler)

@tracer.capture_method
def handle_order_completed(activity_type: str, detail: dict,time: int) -> None:
    order_activity_request: CreateActivityRequest = CreateActivityRequest(
        entityId=detail.get("orderNumber"),
        entityType="order",
        activityType=activity_type,
        activityTime=time,
    )
    create_activity_handler(order_activity_request, dal_handler)

    user_activity_request: CreateActivityRequest = CreateActivityRequest(
        entityId=detail.get("userId"),
        entityType="user",
        activityType=activity_type,
        activityTime=time,
    )
    create_activity_handler(user_activity_request, dal_handler)

@tracer.capture_method
def handle_stock_updated(activity_type: str, detail: dict,time: int) -> None:
    product_activity_request: CreateActivityRequest = CreateActivityRequest(
        entityId=detail.get("productId"),
        entityType="product",
        activityType=activity_type,
        activityTime=time,
    )
    create_activity_handler(product_activity_request, dal_handler)

@tracer.capture_method
def handle_stock_reserved(activity_type: str, detail: dict,time: int) -> None:
    product_activity_request: CreateActivityRequest = CreateActivityRequest(
        entityId=detail.get("orderNumber"),
        entityType="order",
        activityType=activity_type,
        activityTime=time,
    )
    create_activity_handler(product_activity_request, dal_handler)

@tracer.capture_method
def handle_stock_reservation_failed(activity_type: str, detail: dict,time: int) -> None:
    product_activity_request: CreateActivityRequest = CreateActivityRequest(
        entityId=detail.get("orderNumber"),
        entityType="order",
        activityType=activity_type,
        activityTime=time,
    )
    create_activity_handler(product_activity_request, dal_handler)

def convert_date_time_string_to_epoch(date_time_string: str) -> int:
    """
    Convert a date time string to epoch time in milliseconds.
    This is a placeholder function; actual implementation may vary.
    """
    from datetime import datetime
    dt = datetime.strptime(date_time_string, "%Y-%m-%dT%H:%M:%SZ")
    return int(dt.timestamp() * 1000)  # Convert to milliseconds
