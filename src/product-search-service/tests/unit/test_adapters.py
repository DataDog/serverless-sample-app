from __future__ import annotations

from unittest.mock import MagicMock, patch

from product_search_service.models.product import (
    PricingTier,
    ProductMetadata,
)
from product_search_service.observability.messaging import (
    add_messaging_span_tags,
    extract_trace_parent,
)


def make_product(**overrides) -> ProductMetadata:
    """Factory for ProductMetadata with sensible defaults."""
    base: dict = {
        "product_id": "prod-123",
        "name": "Wireless Headphones",
        "price": 79.99,
        "stock_level": 50.0,
        "pricing_tiers": [],
        "last_updated_at": "2026-01-01T00:00:00+00:00",
        "embedding_model": "amazon.titan-embed-text-v2:0",
    }
    base.update(overrides)
    return ProductMetadata.model_validate(base)


# ---------------------------------------------------------------------------
# ProductMetadata.to_embedding_text
# ---------------------------------------------------------------------------


class TestToEmbeddingText:
    def test_basic_format_without_tiers(self) -> None:
        """Should produce name, price, and stock lines when no pricing tiers exist."""
        product = make_product(name="Noise Cancelling Buds", price=49.95, stock_level=120.0)

        text = product.to_embedding_text()

        assert "Product: Noise Cancelling Buds" in text
        assert "Current price: $49.95" in text
        assert "Stock available: 120 units" in text
        assert "Pricing tiers" not in text

    def test_pricing_tiers_are_included_when_present(self) -> None:
        """Should append pricing tier information when tiers are defined."""
        tiers = [PricingTier(quantity=10, price=39.99), PricingTier(quantity=50, price=29.99)]
        product = make_product(pricing_tiers=tiers)

        text = product.to_embedding_text()

        assert "Pricing tiers" in text
        assert "Buy 10+ for $39.99" in text
        assert "Buy 50+ for $29.99" in text

    def test_stock_level_is_formatted_as_integer(self) -> None:
        """Should render stock_level without decimal places."""
        product = make_product(stock_level=7.0)

        text = product.to_embedding_text()

        assert "Stock available: 7 units" in text

    def test_price_is_formatted_to_two_decimal_places(self) -> None:
        """Should always render price with exactly two decimal places."""
        product = make_product(price=100.0)

        text = product.to_embedding_text()

        assert "Current price: $100.00" in text


# ---------------------------------------------------------------------------
# ProductMetadata DynamoDB round-trip
# ---------------------------------------------------------------------------


class TestDynamoRoundTrip:
    def test_to_dynamo_item_contains_expected_keys(self) -> None:
        """Should serialise all fields into a DynamoDB-compatible dict."""
        product = make_product()

        item = product.to_dynamo_item()

        assert item["productId"] == "prod-123"
        assert item["name"] == "Wireless Headphones"
        assert item["price"] == str(79.99)
        assert item["stockLevel"] == str(50.0)
        assert item["pricingTiers"] == []
        assert item["lastUpdatedAt"] == "2026-01-01T00:00:00+00:00"
        assert item["embeddingModel"] == "amazon.titan-embed-text-v2:0"

    def test_pricing_tiers_serialised_to_strings(self) -> None:
        """Should serialise tier prices as strings to avoid DynamoDB Decimal issues."""
        tiers = [PricingTier(quantity=5, price=9.99)]
        product = make_product(pricing_tiers=tiers)

        item = product.to_dynamo_item()

        assert item["pricingTiers"] == [{"quantity": 5, "price": "9.99"}]

    def test_from_dynamo_item_reconstructs_product(self) -> None:
        """Should round-trip a product through DynamoDB serialisation without data loss."""
        original = make_product(
            pricing_tiers=[PricingTier(quantity=10, price=59.99)]
        )

        reconstructed = ProductMetadata.from_dynamo_item(original.to_dynamo_item())

        assert reconstructed.product_id == original.product_id
        assert reconstructed.name == original.name
        assert reconstructed.price == original.price
        assert reconstructed.stock_level == original.stock_level
        assert len(reconstructed.pricing_tiers) == 1
        assert reconstructed.pricing_tiers[0].quantity == 10
        assert reconstructed.pricing_tiers[0].price == 59.99
        assert reconstructed.last_updated_at == original.last_updated_at
        assert reconstructed.embedding_model == original.embedding_model

    def test_from_dynamo_item_handles_missing_optional_fields(self) -> None:
        """Should fall back to defaults when optional DynamoDB fields are absent."""
        minimal_item = {
            "productId": "prod-456",
            "name": "Widget",
            "price": "9.99",
            "stockLevel": "0.0",
        }

        product = ProductMetadata.from_dynamo_item(minimal_item)

        assert product.product_id == "prod-456"
        assert product.pricing_tiers == []
        assert product.last_updated_at == ""
        assert product.embedding_model == "amazon.titan-embed-text-v2:0"

    def test_round_trip_with_multiple_pricing_tiers(self) -> None:
        """Should preserve all pricing tiers through a full DynamoDB round-trip."""
        tiers = [
            PricingTier(quantity=5, price=19.99),
            PricingTier(quantity=20, price=14.99),
            PricingTier(quantity=100, price=9.99),
        ]
        original = make_product(pricing_tiers=tiers)

        reconstructed = ProductMetadata.from_dynamo_item(original.to_dynamo_item())

        assert len(reconstructed.pricing_tiers) == 3
        assert reconstructed.pricing_tiers[1].quantity == 20
        assert reconstructed.pricing_tiers[2].price == 9.99


# ---------------------------------------------------------------------------
# add_messaging_span_tags
# ---------------------------------------------------------------------------


class TestAddMessagingSpanTags:
    def test_sets_standard_messaging_tags_on_current_span(self) -> None:
        """Should apply all OTel messaging semantic convention tags to the active span."""
        mock_span = MagicMock()

        with patch(
            "product_search_service.observability.messaging.tracer"
        ) as mock_tracer:
            mock_tracer.current_span.return_value = mock_span
            add_messaging_span_tags(
                event_type="product.created",
                event_id="evt-001",
                trace_parent=None,
            )

        mock_span.set_tag.assert_any_call("domain", "product-search")
        mock_span.set_tag.assert_any_call("team", "product-search")
        mock_span.set_tag.assert_any_call("messaging.message.type", "product.created")
        mock_span.set_tag.assert_any_call("messaging.message.id", "evt-001")
        mock_span.set_tag.assert_any_call("messaging.operation.type", "process")
        mock_span.set_tag.assert_any_call("messaging.system", "aws_sqs")

    def test_creates_span_link_when_trace_parent_is_provided(self) -> None:
        """Should create a span link from the traceparent when it is present."""
        mock_span = MagicMock()
        trace_parent = "00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01"

        with patch(
            "product_search_service.observability.messaging.tracer"
        ) as mock_tracer, patch(
            "product_search_service.observability.messaging.Context"
        ) as mock_context_cls:
            mock_tracer.current_span.return_value = mock_span
            add_messaging_span_tags(
                event_type="product.updated",
                event_id="evt-002",
                trace_parent=trace_parent,
            )

        mock_context_cls.assert_called_once_with(
            trace_id=int("4bf92f3577b34da6a3ce929d0e0e4736", 16),
            span_id=int("00f067aa0ba902b7", 16),
            is_remote=True,
        )
        mock_span.link_span.assert_called_once()

    def test_does_not_create_span_link_when_trace_parent_is_none(self) -> None:
        """Should skip span linking when no traceparent is available."""
        mock_span = MagicMock()

        with patch(
            "product_search_service.observability.messaging.tracer"
        ) as mock_tracer:
            mock_tracer.current_span.return_value = mock_span
            add_messaging_span_tags(
                event_type="product.deleted",
                event_id="evt-003",
                trace_parent=None,
            )

        mock_span.link_span.assert_not_called()

    def test_does_nothing_when_no_active_span(self) -> None:
        """Should be a no-op when there is no active span."""
        with patch(
            "product_search_service.observability.messaging.tracer"
        ) as mock_tracer:
            mock_tracer.current_span.return_value = None
            add_messaging_span_tags(
                event_type="product.created",
                event_id="evt-004",
                trace_parent=None,
            )

    def test_custom_domain_tag_is_applied(self) -> None:
        """Should use the provided domain value instead of the default."""
        mock_span = MagicMock()

        with patch(
            "product_search_service.observability.messaging.tracer"
        ) as mock_tracer:
            mock_tracer.current_span.return_value = mock_span
            add_messaging_span_tags(
                event_type="product.created",
                event_id="evt-005",
                trace_parent=None,
                domain="custom-domain",
            )

        mock_span.set_tag.assert_any_call("domain", "custom-domain")

    def test_ignores_malformed_trace_parent(self) -> None:
        """Should not attempt span linking when traceparent has wrong part count."""
        mock_span = MagicMock()

        with patch(
            "product_search_service.observability.messaging.tracer"
        ) as mock_tracer:
            mock_tracer.current_span.return_value = mock_span
            add_messaging_span_tags(
                event_type="product.created",
                event_id="evt-006",
                trace_parent="not-a-valid-traceparent",
            )

        mock_span.link_span.assert_not_called()


# ---------------------------------------------------------------------------
# extract_trace_parent
# ---------------------------------------------------------------------------


class TestExtractTraceParent:
    def test_prefers_datadog_envelope_traceparent(self) -> None:
        """Should return the traceparent from _datadog envelope over the top-level key."""
        cloud_event = {
            "_datadog": {"traceparent": "envelope-traceparent"},
            "traceparent": "top-level-traceparent",
        }

        result = extract_trace_parent(cloud_event)

        assert result == "envelope-traceparent"

    def test_falls_back_to_top_level_traceparent(self) -> None:
        """Should return the top-level traceparent when _datadog envelope has none."""
        cloud_event = {
            "_datadog": {},
            "traceparent": "top-level-traceparent",
        }

        result = extract_trace_parent(cloud_event)

        assert result == "top-level-traceparent"

    def test_returns_none_when_no_traceparent_present(self) -> None:
        """Should return None when traceparent is absent from both locations."""
        cloud_event: dict = {}

        result = extract_trace_parent(cloud_event)

        assert result is None

    def test_handles_missing_datadog_envelope(self) -> None:
        """Should not raise when the _datadog key is absent from the cloud event."""
        cloud_event = {"traceparent": "top-level-traceparent"}

        result = extract_trace_parent(cloud_event)

        assert result == "top-level-traceparent"

    def test_handles_none_datadog_envelope(self) -> None:
        """Should treat a None _datadog envelope the same as an empty dict."""
        cloud_event = {"_datadog": None, "traceparent": "top-level-traceparent"}

        result = extract_trace_parent(cloud_event)

        assert result == "top-level-traceparent"

    def test_returns_none_when_event_is_empty(self) -> None:
        """Should return None for a completely empty cloud event."""
        result = extract_trace_parent({})

        assert result is None
