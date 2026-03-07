from __future__ import annotations

import json
from typing import Any
from unittest.mock import MagicMock, patch

import pytest

from product_search_service.handlers.catalog_sync import (
    PRICING_CALCULATED,
    PRODUCT_CREATED,
    PRODUCT_DELETED,
    PRODUCT_UPDATED,
    STOCK_UPDATED,
    lambda_handler,
)
from product_search_service.models.product import PricingTier, ProductMetadata


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def make_sqs_event(event_type: str, data: dict[str, Any]) -> dict[str, Any]:
    """Build a minimal SQS event wrapping a CloudEvent in an EventBridge envelope.

    Args:
        event_type: The CloudEvent ``type`` field value.
        data: The CloudEvent ``data`` payload.

    Returns:
        A dict shaped like the AWS Lambda SQS event structure.
    """
    cloud_event = {
        "type": event_type,
        "id": "test-event-id",
        "traceparent": "00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01",
        "_datadog": {
            "traceparent": "00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01",
        },
        "data": data,
    }
    return {
        "Records": [
            {
                "messageId": "test-message-id",
                "body": json.dumps({"detail": cloud_event, "detail-type": event_type}),
                "attributes": {},
                "messageAttributes": {},
                "md5OfBody": "",
                "eventSource": "aws:sqs",
                "eventSourceARN": "arn:aws:sqs:us-east-1:123456789:test-queue",
                "awsRegion": "us-east-1",
            }
        ]
    }


def make_product(product_id: str = "prod-123", **overrides: Any) -> ProductMetadata:
    """Factory for creating test ProductMetadata instances.

    Args:
        product_id: The product identifier.
        **overrides: Field overrides applied on top of the defaults.

    Returns:
        A fully populated ProductMetadata instance.
    """
    base: dict[str, Any] = {
        "product_id": product_id,
        "name": "Test Widget",
        "price": 9.99,
        "stock_level": 100.0,
        "pricing_tiers": [],
        "last_updated_at": "2026-03-06T00:00:00Z",
        "embedding_model": "amazon.titan-embed-text-v2:0",
    }
    base.update(overrides)
    return ProductMetadata.model_validate(base)


_FAKE_EMBEDDING = [0.1, 0.2, 0.3]
_LAMBDA_CONTEXT = MagicMock()


# ---------------------------------------------------------------------------
# Shared patch targets
# ---------------------------------------------------------------------------

_PATCH_EMBEDDER = "product_search_service.handlers.catalog_sync._get_embedder"
_PATCH_VECTOR = "product_search_service.handlers.catalog_sync._get_vector_repo"
_PATCH_METADATA = "product_search_service.handlers.catalog_sync._get_metadata_repo"
_PATCH_PRODUCT_API = "product_search_service.handlers.catalog_sync._get_product_api"
_PATCH_DSM = "product_search_service.handlers.catalog_sync.set_dsm_consume_checkpoint"
_PATCH_SPAN_TAGS = "product_search_service.handlers.catalog_sync.add_messaging_span_tags"


# ---------------------------------------------------------------------------
# Tests
# ---------------------------------------------------------------------------


class TestProductCreatedEvent:
    def test_product_created_event_embeds_and_stores(self) -> None:
        """A product.created event should embed the product and write to both stores.

        DynamoDB (metadata_repo) must be written before the vector store so that
        a partial failure leaves the system in a consistent retryable state.
        """
        product = make_product()
        event = make_sqs_event(PRODUCT_CREATED, {"productId": product.product_id})

        embedder = MagicMock()
        embedder.embed.return_value = _FAKE_EMBEDDING
        vector_repo = MagicMock()
        metadata_repo = MagicMock()
        product_api = MagicMock()
        product_api.get_product.return_value = product

        call_order: list[str] = []
        metadata_repo.upsert.side_effect = lambda *_: call_order.append("metadata_upsert")
        vector_repo.upsert.side_effect = lambda *_: call_order.append("vector_upsert")

        with (
            patch(_PATCH_EMBEDDER, return_value=embedder),
            patch(_PATCH_VECTOR, return_value=vector_repo),
            patch(_PATCH_METADATA, return_value=metadata_repo),
            patch(_PATCH_PRODUCT_API, return_value=product_api),
            patch(_PATCH_DSM),
            patch(_PATCH_SPAN_TAGS),
        ):
            lambda_handler(event, _LAMBDA_CONTEXT)

        product_api.get_product.assert_called_once_with(product.product_id)
        embedder.embed.assert_called_once_with(product.to_embedding_text())
        metadata_repo.upsert.assert_called_once_with(product)
        vector_repo.upsert.assert_called_once_with(
            product.product_id,
            _FAKE_EMBEDDING,
            {"name": product.name, "price": str(product.price)},
        )
        assert call_order == ["metadata_upsert", "vector_upsert"], (
            "DynamoDB (metadata) must be written before S3 Vectors"
        )

    def test_product_api_failure_raises_for_retry(self) -> None:
        """When the product API returns None on create, a ValueError should propagate."""
        event = make_sqs_event(PRODUCT_CREATED, {"productId": "missing-prod"})

        product_api = MagicMock()
        product_api.get_product.return_value = None

        with (
            patch(_PATCH_EMBEDDER, return_value=MagicMock()),
            patch(_PATCH_VECTOR, return_value=MagicMock()),
            patch(_PATCH_METADATA, return_value=MagicMock()),
            patch(_PATCH_PRODUCT_API, return_value=product_api),
            patch(_PATCH_DSM),
            patch(_PATCH_SPAN_TAGS),
        ):
            result = lambda_handler(event, _LAMBDA_CONTEXT)

        assert result["batchItemFailures"], "Expected the record to be reported as a failure"


class TestProductUpdatedEvent:
    def test_product_updated_event_embeds_and_stores(self) -> None:
        """A product.updated event should re-embed and update both stores.

        DynamoDB (metadata_repo) must be written before the vector store.
        """
        product = make_product()
        event = make_sqs_event(PRODUCT_UPDATED, {"productId": product.product_id})

        embedder = MagicMock()
        embedder.embed.return_value = _FAKE_EMBEDDING
        vector_repo = MagicMock()
        metadata_repo = MagicMock()
        product_api = MagicMock()
        product_api.get_product.return_value = product

        call_order: list[str] = []
        metadata_repo.upsert.side_effect = lambda *_: call_order.append("metadata_upsert")
        vector_repo.upsert.side_effect = lambda *_: call_order.append("vector_upsert")

        with (
            patch(_PATCH_EMBEDDER, return_value=embedder),
            patch(_PATCH_VECTOR, return_value=vector_repo),
            patch(_PATCH_METADATA, return_value=metadata_repo),
            patch(_PATCH_PRODUCT_API, return_value=product_api),
            patch(_PATCH_DSM),
            patch(_PATCH_SPAN_TAGS),
        ):
            lambda_handler(event, _LAMBDA_CONTEXT)

        embedder.embed.assert_called_once()
        metadata_repo.upsert.assert_called_once_with(product)
        vector_repo.upsert.assert_called_once()
        assert call_order == ["metadata_upsert", "vector_upsert"], (
            "DynamoDB (metadata) must be written before S3 Vectors"
        )

    def test_product_api_failure_raises_for_retry(self) -> None:
        """When the product API returns None on update, a ValueError should propagate."""
        event = make_sqs_event(PRODUCT_UPDATED, {"productId": "missing-prod"})

        product_api = MagicMock()
        product_api.get_product.return_value = None

        with (
            patch(_PATCH_EMBEDDER, return_value=MagicMock()),
            patch(_PATCH_VECTOR, return_value=MagicMock()),
            patch(_PATCH_METADATA, return_value=MagicMock()),
            patch(_PATCH_PRODUCT_API, return_value=product_api),
            patch(_PATCH_DSM),
            patch(_PATCH_SPAN_TAGS),
        ):
            result = lambda_handler(event, _LAMBDA_CONTEXT)

        assert result["batchItemFailures"], "Expected the record to be reported as a failure"


class TestProductDeletedEvent:
    def test_product_deleted_event_removes_from_stores(self) -> None:
        """A product.deleted event should remove the product from vector and metadata stores."""
        product_id = "prod-to-delete"
        event = make_sqs_event(PRODUCT_DELETED, {"productId": product_id})

        vector_repo = MagicMock()
        metadata_repo = MagicMock()

        with (
            patch(_PATCH_EMBEDDER, return_value=MagicMock()),
            patch(_PATCH_VECTOR, return_value=vector_repo),
            patch(_PATCH_METADATA, return_value=metadata_repo),
            patch(_PATCH_PRODUCT_API, return_value=MagicMock()),
            patch(_PATCH_DSM),
            patch(_PATCH_SPAN_TAGS),
        ):
            lambda_handler(event, _LAMBDA_CONTEXT)

        vector_repo.delete.assert_called_once_with(product_id)
        metadata_repo.delete.assert_called_once_with(product_id)


class TestPricingCalculatedEvent:
    def test_pricing_calculated_updates_and_reembeds(self) -> None:
        """A pricing.calculated event should update pricing tiers and re-embed."""
        product = make_product()
        price_brackets = [{"quantity": 10, "price": 8.99}, {"quantity": 50, "price": 7.49}]
        event = make_sqs_event(
            PRICING_CALCULATED,
            {"productId": product.product_id, "priceBrackets": price_brackets},
        )

        embedder = MagicMock()
        embedder.embed.return_value = _FAKE_EMBEDDING
        vector_repo = MagicMock()
        metadata_repo = MagicMock()
        metadata_repo.get.return_value = product

        with (
            patch(_PATCH_EMBEDDER, return_value=embedder),
            patch(_PATCH_VECTOR, return_value=vector_repo),
            patch(_PATCH_METADATA, return_value=metadata_repo),
            patch(_PATCH_PRODUCT_API, return_value=MagicMock()),
            patch(_PATCH_DSM),
            patch(_PATCH_SPAN_TAGS),
        ):
            lambda_handler(event, _LAMBDA_CONTEXT)

        expected_tiers = [PricingTier(quantity=10, price=8.99), PricingTier(quantity=50, price=7.49)]
        metadata_repo.update_pricing.assert_called_once_with(product.product_id, expected_tiers)
        embedder.embed.assert_called_once()
        vector_repo.upsert.assert_called_once()

    def test_pricing_calculated_drops_gracefully_when_product_missing_everywhere(self) -> None:
        """When neither the metadata cache nor the Product API has the product, the event is dropped gracefully."""
        event = make_sqs_event(
            PRICING_CALCULATED,
            {"productId": "ghost-prod", "priceBrackets": [{"quantity": 1, "price": 5.0}]},
        )

        embedder = MagicMock()
        vector_repo = MagicMock()
        metadata_repo = MagicMock()
        metadata_repo.get.return_value = None
        product_api = MagicMock()
        product_api.get_product.return_value = None

        with (
            patch(_PATCH_EMBEDDER, return_value=embedder),
            patch(_PATCH_VECTOR, return_value=vector_repo),
            patch(_PATCH_METADATA, return_value=metadata_repo),
            patch(_PATCH_PRODUCT_API, return_value=product_api),
            patch(_PATCH_DSM),
            patch(_PATCH_SPAN_TAGS),
        ):
            result = lambda_handler(event, _LAMBDA_CONTEXT)

        assert result["batchItemFailures"] == [], (
            "Event should be dropped gracefully when product is not found anywhere"
        )
        embedder.embed.assert_not_called()
        vector_repo.upsert.assert_not_called()
        metadata_repo.update_pricing.assert_not_called()


class TestStockUpdatedEvent:
    def test_stock_updated_updates_and_reembeds(self) -> None:
        """A stock.updated event should update stock level and re-embed the product."""
        product = make_product(stock_level=50.0)
        event = make_sqs_event(
            STOCK_UPDATED,
            {"productId": product.product_id, "stockLevel": 75.0},
        )

        embedder = MagicMock()
        embedder.embed.return_value = _FAKE_EMBEDDING
        vector_repo = MagicMock()
        metadata_repo = MagicMock()
        metadata_repo.get.return_value = product

        with (
            patch(_PATCH_EMBEDDER, return_value=embedder),
            patch(_PATCH_VECTOR, return_value=vector_repo),
            patch(_PATCH_METADATA, return_value=metadata_repo),
            patch(_PATCH_PRODUCT_API, return_value=MagicMock()),
            patch(_PATCH_DSM),
            patch(_PATCH_SPAN_TAGS),
        ):
            lambda_handler(event, _LAMBDA_CONTEXT)

        metadata_repo.update_stock.assert_called_once_with(product.product_id, 75.0)
        embedder.embed.assert_called_once()
        vector_repo.upsert.assert_called_once()

    def test_stock_updated_drops_gracefully_when_product_missing_everywhere(self) -> None:
        """When neither the metadata cache nor the Product API has the product, the event is dropped gracefully."""
        event = make_sqs_event(
            STOCK_UPDATED,
            {"productId": "ghost-prod", "stockLevel": 10.0},
        )

        embedder = MagicMock()
        vector_repo = MagicMock()
        metadata_repo = MagicMock()
        metadata_repo.get.return_value = None
        product_api = MagicMock()
        product_api.get_product.return_value = None

        with (
            patch(_PATCH_EMBEDDER, return_value=embedder),
            patch(_PATCH_VECTOR, return_value=vector_repo),
            patch(_PATCH_METADATA, return_value=metadata_repo),
            patch(_PATCH_PRODUCT_API, return_value=product_api),
            patch(_PATCH_DSM),
            patch(_PATCH_SPAN_TAGS),
        ):
            result = lambda_handler(event, _LAMBDA_CONTEXT)

        assert result["batchItemFailures"] == [], (
            "Event should be dropped gracefully when product is not found anywhere"
        )
        embedder.embed.assert_not_called()
        vector_repo.upsert.assert_not_called()
        metadata_repo.update_stock.assert_not_called()


class TestMalformedEvents:
    def test_missing_product_id_in_event_data_reports_batch_item_failure(self) -> None:
        """When productId is missing from event data, the record should report as a batch item failure."""
        event = make_sqs_event(PRODUCT_CREATED, {})

        with (
            patch(_PATCH_EMBEDDER, return_value=MagicMock()),
            patch(_PATCH_VECTOR, return_value=MagicMock()),
            patch(_PATCH_METADATA, return_value=MagicMock()),
            patch(_PATCH_PRODUCT_API, return_value=MagicMock()),
            patch(_PATCH_DSM),
            patch(_PATCH_SPAN_TAGS),
        ):
            result = lambda_handler(event, _LAMBDA_CONTEXT)

        assert result["batchItemFailures"], "Expected the record to fail when productId is missing"


class TestUnknownEventType:
    def test_unknown_event_type_is_skipped_gracefully(self) -> None:
        """An unrecognised event type should be silently skipped without raising."""
        event = make_sqs_event("unknown.event.v1", {"someField": "someValue"})

        embedder = MagicMock()
        vector_repo = MagicMock()
        metadata_repo = MagicMock()

        with (
            patch(_PATCH_EMBEDDER, return_value=embedder),
            patch(_PATCH_VECTOR, return_value=vector_repo),
            patch(_PATCH_METADATA, return_value=metadata_repo),
            patch(_PATCH_PRODUCT_API, return_value=MagicMock()),
            patch(_PATCH_DSM),
            patch(_PATCH_SPAN_TAGS),
        ):
            result = lambda_handler(event, _LAMBDA_CONTEXT)

        assert result["batchItemFailures"] == [], "Unknown event types must not fail the batch record"
        embedder.embed.assert_not_called()
        vector_repo.upsert.assert_not_called()
        metadata_repo.upsert.assert_not_called()
