from __future__ import annotations

import time
from datetime import UTC, datetime

import boto3
from aws_lambda_powertools import Logger
from ddtrace import tracer

from product_search_service.models.product import ProductMetadata, PricingTier

logger = Logger()

MAX_BATCH_RETRIES = 5


class MetadataRepository:
    """DynamoDB-backed cache for product metadata."""

    def __init__(self, table_name: str) -> None:
        self._table = boto3.resource("dynamodb").Table(table_name)

    def upsert(self, product: ProductMetadata) -> None:
        """Store or replace a product metadata record.

        Args:
            product: The product metadata to persist.
        """
        self._table.put_item(Item=product.to_dynamo_item())

    def get(self, product_id: str) -> ProductMetadata | None:
        """Retrieve a product by ID.

        Args:
            product_id: The unique product identifier.

        Returns:
            The product metadata, or ``None`` if the product is not found.
        """
        response = self._table.get_item(Key={"productId": product_id})
        item = response.get("Item")
        if not item:
            return None
        return ProductMetadata.from_dynamo_item(item)

    def update_pricing(self, product_id: str, pricing_tiers: list[PricingTier]) -> None:
        """Update only the pricing tiers for a product.

        Args:
            product_id: The unique product identifier.
            pricing_tiers: The updated list of pricing tiers.
        """
        self._table.update_item(
            Key={"productId": product_id},
            UpdateExpression="SET pricingTiers = :tiers, lastUpdatedAt = :ts",
            ExpressionAttributeValues={
                ":tiers": [
                    {"quantity": t.quantity, "price": str(t.price)}
                    for t in pricing_tiers
                ],
                ":ts": datetime.now(UTC).isoformat(),
            },
        )

    def update_stock(self, product_id: str, stock_level: float) -> None:
        """Update only the stock level for a product.

        Args:
            product_id: The unique product identifier.
            stock_level: The new stock level.
        """
        self._table.update_item(
            Key={"productId": product_id},
            UpdateExpression="SET stockLevel = :stock, lastUpdatedAt = :ts",
            ExpressionAttributeValues={
                ":stock": str(stock_level),
                ":ts": datetime.now(UTC).isoformat(),
            },
        )

    def delete(self, product_id: str) -> None:
        """Delete a product metadata record.

        Args:
            product_id: The unique product identifier to remove.
        """
        self._table.delete_item(Key={"productId": product_id})

    @tracer.wrap(resource="metadata_repository.batch_get")
    def batch_get(self, product_ids: list[str]) -> list[ProductMetadata]:
        """Retrieve multiple products by ID. Missing IDs are silently skipped.

        Retries DynamoDB UnprocessedKeys until all requested items are returned,
        as required by the batch_get_item API contract.

        Args:
            product_ids: List of product IDs to retrieve.

        Returns:
            List of ProductMetadata instances for found products. Order is not guaranteed.
        """
        if not product_ids:
            return []

        client = self._table.meta.client
        remaining_keys: list[dict] = [{"productId": pid} for pid in product_ids]
        all_items: list[dict] = []
        retry_count = 0

        while remaining_keys:
            if retry_count >= MAX_BATCH_RETRIES:
                logger.error(
                    "batch_get exceeded max retries for UnprocessedKeys",
                    remaining_key_count=len(remaining_keys),
                )
                raise RuntimeError(
                    f"DynamoDB batch_get failed after {MAX_BATCH_RETRIES} retries with {len(remaining_keys)} unprocessed keys"
                )

            if retry_count > 0:
                time.sleep(0.1 * (2 ** retry_count))

            response = client.batch_get_item(
                RequestItems={self._table.name: {"Keys": remaining_keys}}
            )
            batch_items = response.get("Responses", {}).get(self._table.name, [])
            all_items.extend(batch_items)

            unprocessed = response.get("UnprocessedKeys", {}).get(self._table.name, {})
            remaining_keys = unprocessed.get("Keys", [])
            retry_count += 1

        span = tracer.current_span()
        if span:
            span.set_tag("dynamo.keys_requested", len(product_ids))
            span.set_tag("dynamo.items_returned", len(all_items))
            span.set_tag("dynamo.retry_count", retry_count - 1)

        return [ProductMetadata.from_dynamo_item(item) for item in all_items]
