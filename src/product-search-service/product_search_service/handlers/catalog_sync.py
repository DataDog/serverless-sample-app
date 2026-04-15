from __future__ import annotations

import json
import os
from typing import Any, Callable

from aws_lambda_powertools import Logger
from aws_lambda_powertools.utilities.batch import BatchProcessor, EventType, process_partial_response
from aws_lambda_powertools.utilities.batch.types import PartialItemFailureResponse
from aws_lambda_powertools.utilities.data_classes import SQSEvent
from aws_lambda_powertools.utilities.data_classes.sqs_event import SQSRecord
from aws_lambda_powertools.utilities.typing import LambdaContext
from ddtrace import tracer

from product_search_service.adapters.bedrock_embedder import BedrockEmbedder
from product_search_service.adapters.metadata_repository import MetadataRepository
from product_search_service.adapters.product_api_client import ProductApiClient
from product_search_service.adapters.vector_repository import VectorRepository
from product_search_service.models.product import PricingTier
from product_search_service.observability.messaging import (
    add_messaging_span_tags,
    extract_trace_parent,
    set_dsm_consume_checkpoint,
)

PRODUCT_CREATED = "product.productCreated.v1"
PRODUCT_UPDATED = "product.productUpdated.v1"
PRODUCT_DELETED = "product.productDeleted.v1"
PRICING_CALCULATED = "pricing.pricingCalculated.v1"
STOCK_UPDATED = "inventory.stockUpdated.v1"

logger = Logger()
tracer.set_tags({"domain": "product-search", "team": "product-search"})
processor = BatchProcessor(event_type=EventType.SQS, raise_on_entire_batch_failure=False)

_embedder: BedrockEmbedder | None = None
_vector_repo: VectorRepository | None = None
_metadata_repo: MetadataRepository | None = None
_product_api: ProductApiClient | None = None


def _get_embedder() -> BedrockEmbedder:
    """Return the shared BedrockEmbedder, initialising it on first call."""
    global _embedder
    if _embedder is None:
        model_id = os.environ.get("EMBEDDING_MODEL_ID", "amazon.titan-embed-text-v2:0")
        _embedder = BedrockEmbedder(model_id=model_id)
    return _embedder


def _get_vector_repo() -> VectorRepository:
    """Return the shared VectorRepository, initialising it on first call."""
    global _vector_repo
    if _vector_repo is None:
        bucket_name = os.environ.get("VECTOR_BUCKET_NAME", "serverless-sample-app-vector-dev")
        _vector_repo = VectorRepository(bucket_name=bucket_name)
    return _vector_repo


def _get_metadata_repo() -> MetadataRepository:
    """Return the shared MetadataRepository, initialising it on first call."""
    global _metadata_repo
    if _metadata_repo is None:
        table_name = os.environ.get("METADATA_TABLE_NAME", "product-search-metadata")
        _metadata_repo = MetadataRepository(table_name=table_name)
    return _metadata_repo


def _get_product_api() -> ProductApiClient:
    """Return the shared ProductApiClient, initialising it on first call."""
    global _product_api
    if _product_api is None:
        parameter_name = os.environ.get(
            "PRODUCT_API_ENDPOINT_PARAMETER",
            "/dev/ProductService/api-endpoint",
        )
        _product_api = ProductApiClient(endpoint_parameter=parameter_name)
    return _product_api


EventHandler = Callable[..., None]

_EVENT_HANDLER_REGISTRY: dict[str, EventHandler] | None = None


def _get_event_handler_registry() -> dict[str, EventHandler]:
    """Return the mapping of event type names to handler functions.

    Deferred initialisation ensures all handler functions are defined before
    the registry is built.

    Returns:
        A dict mapping event type strings to handler callables.
    """
    global _EVENT_HANDLER_REGISTRY
    if _EVENT_HANDLER_REGISTRY is None:
        _EVENT_HANDLER_REGISTRY = {
            PRODUCT_CREATED: handle_product_created,
            PRODUCT_UPDATED: handle_product_updated,
            PRODUCT_DELETED: handle_product_deleted,
            PRICING_CALCULATED: handle_pricing_calculated,
            STOCK_UPDATED: handle_stock_updated,
        }
    return _EVENT_HANDLER_REGISTRY


@logger.inject_lambda_context
def lambda_handler(event: SQSEvent, context: LambdaContext) -> PartialItemFailureResponse:
    """Process SQS messages containing EventBridge events with partial batch response support.

    Args:
        event: The SQS event containing one or more records.
        context: The Lambda execution context.

    Returns:
        A partial item failure response indicating which records failed.
    """
    span = tracer.current_span()
    if span:
        span.set_tag("messaging.system", "sqs")
        span.set_tag("messaging.operation.type", "receive")

    return process_partial_response(
        event=event,
        record_handler=lambda record: _process_record(record),
        processor=processor,
        context=context,
    )


def _process_record(record: SQSRecord) -> None:
    """Process a single SQS record by routing to the appropriate event handler.

    Args:
        record: The SQS record to process.

    Raises:
        Exception: Any exception raised by an event handler propagates to trigger
            SQS partial batch failure handling.
    """
    message_body = json.loads(record.body)
    cloud_event: dict[str, Any] = message_body.get("detail", {})
    event_type: str = cloud_event.get("type", "")

    set_dsm_consume_checkpoint(event_type, cloud_event)

    handler = _get_event_handler_registry().get(event_type)
    if handler is None:
        logger.warning("Unhandled event type", event_type=event_type)
        return

    event_id: str | None = cloud_event.get("id")
    trace_parent = extract_trace_parent(cloud_event)
    event_data: dict[str, Any] = cloud_event.get("data", {})

    try:
        handler(event_id=event_id, event_type=event_type, data=event_data, trace_parent=trace_parent)
    except Exception as e:
        span = tracer.current_span()
        if span:
            span.error = 1
            span.set_tag("error.message", str(e))
            span.set_tag("error.type", type(e).__name__)
        raise  # re-raise so process_partial_response reports the batch item failure


def _index_product(
    product_id: str,
    event_type: str,
    event_id: str | None,
    trace_parent: str | None,
) -> None:
    """Fetch, embed, and store a product in both the vector store and metadata cache.

    Args:
        product_id: The product identifier.
        event_type: The cloud event type string.
        event_id: The cloud event unique identifier.
        trace_parent: W3C traceparent header, if available.

    Raises:
        ValueError: When the product cannot be found via the product API,
            causing SQS to retry the message.
    """
    add_messaging_span_tags(event_type, event_id, trace_parent)

    product = _get_product_api().get_product(product_id)
    if product is None:
        raise ValueError(f"Product '{product_id}' not found via product API — will retry")

    embedding = _get_embedder().embed(product.to_embedding_text())
    _get_metadata_repo().upsert(product)    # DynamoDB first — idempotent on retry
    _get_vector_repo().upsert(product_id, embedding, {"name": product.name, "price": str(product.price)})

    span = tracer.current_span()
    if span:
        span.set_tag("product.id", product_id)

    logger.info("Product indexed successfully", product_id=product_id, event_type=event_type)


@tracer.wrap(resource=f"process {PRODUCT_CREATED}")
def handle_product_created(
    event_id: str | None,
    event_type: str,
    data: dict[str, Any],
    trace_parent: str | None,
) -> None:
    """Handle a product creation event by embedding and storing the product.

    Args:
        event_id: The cloud event unique identifier.
        event_type: The cloud event type string.
        data: The cloud event data payload.
        trace_parent: W3C traceparent header, if available.

    Raises:
        ValueError: When the product cannot be found via the product API,
            causing SQS to retry the message.
    """
    product_id: str = _require_field(data, "productId")
    _index_product(product_id, event_type, event_id, trace_parent)


@tracer.wrap(resource=f"process {PRODUCT_UPDATED}")
def handle_product_updated(
    event_id: str | None,
    event_type: str,
    data: dict[str, Any],
    trace_parent: str | None,
) -> None:
    """Handle a product update event by re-embedding and updating stores.

    Args:
        event_id: The cloud event unique identifier.
        event_type: The cloud event type string.
        data: The cloud event data payload.
        trace_parent: W3C traceparent header, if available.

    Raises:
        ValueError: When the product cannot be found via the product API,
            causing SQS to retry the message.
    """
    product_id: str = _require_field(data, "productId")
    _index_product(product_id, event_type, event_id, trace_parent)


@tracer.wrap(resource=f"process {PRODUCT_DELETED}")
def handle_product_deleted(
    event_id: str | None,
    event_type: str,
    data: dict[str, Any],
    trace_parent: str | None,
) -> None:
    """Handle a product deletion event by removing the product from all stores.

    Args:
        event_id: The cloud event unique identifier.
        event_type: The cloud event type string.
        data: The cloud event data payload.
        trace_parent: W3C traceparent header, if available.
    """
    add_messaging_span_tags(event_type, event_id, trace_parent)

    product_id: str = _require_field(data, "productId")

    _get_vector_repo().delete(product_id)
    _get_metadata_repo().delete(product_id)

    span = tracer.current_span()
    if span:
        span.set_tag("product.id", product_id)

    logger.info("Successfully processed product deletion", product_id=product_id)


@tracer.wrap(resource=f"process {PRICING_CALCULATED}")
def handle_pricing_calculated(
    event_id: str | None,
    event_type: str,
    data: dict[str, Any],
    trace_parent: str | None,
) -> None:
    """Handle a pricing update event by refreshing pricing tiers and re-embedding.

    Args:
        event_id: The cloud event unique identifier.
        event_type: The cloud event type string.
        data: The cloud event data payload.
        trace_parent: W3C traceparent header, if available.

    Raises:
        ValueError: When the product is not yet in the metadata cache, causing
            SQS to retry the message via the DLQ maxReceiveCount limit.
    """
    add_messaging_span_tags(event_type, event_id, trace_parent)

    product_id: str = _require_field(data, "productId")
    raw_brackets: list[dict[str, Any]] = data.get("priceBrackets", [])
    pricing_tiers = [
        PricingTier(quantity=int(b["quantity"]), price=float(b["price"]))
        for b in raw_brackets
    ]

    existing = _get_metadata_repo().get(product_id)
    if existing is None:
        # Product not in cache — proactively index it from the Product API.
        # This handles both race conditions (productCreated not yet processed)
        # and fresh deployments where existing products have never been indexed.
        logger.info("Product not in cache, indexing proactively before pricing update", product_id=product_id)
        existing = _get_product_api().get_product(product_id)
        if existing is None:
            logger.warning("Product not found in Product API, dropping pricing event", product_id=product_id)
            return
        initial_embedding = _get_embedder().embed(existing.to_embedding_text())
        _get_metadata_repo().upsert(existing)
        _get_vector_repo().upsert(product_id, initial_embedding, {"name": existing.name, "price": str(existing.price)})

    _get_metadata_repo().update_pricing(product_id, pricing_tiers)
    existing.pricing_tiers = pricing_tiers

    embedding = _get_embedder().embed(existing.to_embedding_text())
    _get_vector_repo().upsert(product_id, embedding, {"name": existing.name, "price": str(existing.price)})

    span = tracer.current_span()
    if span:
        span.set_tag("product.id", product_id)

    logger.info("Successfully processed pricing update", product_id=product_id)


@tracer.wrap(resource=f"process {STOCK_UPDATED}")
def handle_stock_updated(
    event_id: str | None,
    event_type: str,
    data: dict[str, Any],
    trace_parent: str | None,
) -> None:
    """Handle a stock level update event by refreshing stock and re-embedding.

    Args:
        event_id: The cloud event unique identifier.
        event_type: The cloud event type string.
        data: The cloud event data payload.
        trace_parent: W3C traceparent header, if available.

    Raises:
        ValueError: When the product is not yet in the metadata cache, causing
            SQS to retry the message via the DLQ maxReceiveCount limit.
    """
    add_messaging_span_tags(event_type, event_id, trace_parent)

    product_id: str = _require_field(data, "productId")
    stock_level: float = float(data.get("stockLevel", 0))

    existing = _get_metadata_repo().get(product_id)
    if existing is None:
        # Product not in cache — proactively index it from the Product API.
        # This handles both race conditions (productCreated not yet processed)
        # and fresh deployments where existing products have never been indexed.
        logger.info("Product not in cache, indexing proactively before stock update", product_id=product_id)
        existing = _get_product_api().get_product(product_id)
        if existing is None:
            logger.warning("Product not found in Product API, removing from search index", product_id=product_id)
            _get_metadata_repo().delete(product_id)
            _get_vector_repo().delete(product_id)
            return
        initial_embedding = _get_embedder().embed(existing.to_embedding_text())
        _get_metadata_repo().upsert(existing)
        _get_vector_repo().upsert(product_id, initial_embedding, {"name": existing.name, "price": str(existing.price)})

    _get_metadata_repo().update_stock(product_id, stock_level)
    existing.stock_level = stock_level

    embedding = _get_embedder().embed(existing.to_embedding_text())
    _get_vector_repo().upsert(product_id, embedding, {"name": existing.name, "price": str(existing.price)})

    span = tracer.current_span()
    if span:
        span.set_tag("product.id", product_id)

    logger.info("Successfully processed stock update", product_id=product_id)


def _require_field(data: dict[str, Any], field_name: str) -> str:
    """Extract a required string field from a data dict.

    Args:
        data: The dict to extract from.
        field_name: The key to look up.

    Returns:
        The string value for the given key.

    Raises:
        ValueError: When the field is missing or empty.
    """
    value: str | None = data.get(field_name)
    if not value:
        raise ValueError(f"Required field '{field_name}' is missing or empty in event data")
    return value
