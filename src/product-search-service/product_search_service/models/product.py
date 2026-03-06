from __future__ import annotations

from pydantic import BaseModel, ConfigDict, Field
from pydantic.alias_generators import to_camel


class PricingTier(BaseModel):
    """A quantity-based pricing tier for a product."""

    quantity: int
    price: float


class ProductMetadata(BaseModel):
    """Full product metadata stored in DynamoDB and used for embedding."""

    product_id: str
    name: str
    price: float
    stock_level: float
    pricing_tiers: list[PricingTier] = Field(default_factory=list)
    last_updated_at: str
    embedding_model: str = "amazon.titan-embed-text-v2:0"

    def to_embedding_text(self) -> str:
        """Compose the text that gets embedded for this product.

        Returns:
            A human-readable string describing the product, suitable for embedding.
        """
        tier_parts = [
            f"Buy {t.quantity}+ for ${t.price:.2f}" for t in self.pricing_tiers
        ]
        tier_str = f"\nPricing tiers: {'; '.join(tier_parts)}" if tier_parts else ""
        return (
            f"Product: {self.name}\n"
            f"Current price: ${self.price:.2f}\n"
            f"Stock available: {self.stock_level:.0f} units"
            f"{tier_str}"
        )

    def to_dynamo_item(self) -> dict:
        """Serialise to DynamoDB item format.

        Returns:
            A dict keyed with DynamoDB attribute names, with all numeric values
            stored as strings to avoid DynamoDB Decimal precision issues.
        """
        return {
            "productId": self.product_id,
            "name": self.name,
            "price": str(self.price),
            "stockLevel": str(self.stock_level),
            "pricingTiers": [
                {"quantity": t.quantity, "price": str(t.price)}
                for t in self.pricing_tiers
            ],
            "lastUpdatedAt": self.last_updated_at,
            "embeddingModel": self.embedding_model,
        }

    @classmethod
    def from_dynamo_item(cls, item: dict) -> ProductMetadata:
        """Deserialise from DynamoDB item format.

        Args:
            item: A DynamoDB item dict as returned by boto3.

        Returns:
            A fully populated ProductMetadata instance.
        """
        pricing_tiers = [
            PricingTier(quantity=int(t["quantity"]), price=float(t["price"]))
            for t in item.get("pricingTiers", [])
        ]
        return cls(
            product_id=item["productId"],
            name=item["name"],
            price=float(item["price"]),
            stock_level=float(item["stockLevel"]),
            pricing_tiers=pricing_tiers,
            last_updated_at=item.get("lastUpdatedAt", ""),
            embedding_model=item.get("embeddingModel", "amazon.titan-embed-text-v2:0"),
        )


class ProductSummary(BaseModel):
    """Lightweight product summary included in search responses."""

    model_config = ConfigDict(alias_generator=to_camel, populate_by_name=True)

    product_id: str
    name: str
    price: float
    stock_level: float


class SearchResponse(BaseModel):
    """Response returned by the product search endpoint."""

    answer: str
    products: list[ProductSummary]
