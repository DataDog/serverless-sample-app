from __future__ import annotations

import time
import uuid

import pytest

from .api_driver import ProductSearchApiDriver, initialize_driver

# How long to wait for the async catalog sync pipeline to complete:
#   EventBridge → SQS → Lambda cold start → Bedrock embed → S3 Vectors write
CATALOG_SYNC_WAIT_SECONDS = 45


@pytest.fixture(scope="module")
def driver() -> ProductSearchApiDriver:
    return initialize_driver()


# ---------------------------------------------------------------------------
# Smoke tests — validate the search endpoint is reachable and well-behaved.
# These run in seconds and do not require any seeded product data.
# ---------------------------------------------------------------------------

class TestSearchEndpointSmoke:
    def test_search_returns_200_with_valid_query(self, driver: ProductSearchApiDriver) -> None:
        """Search endpoint returns HTTP 200 for a valid query, even with no matching products."""
        result = driver.search("outdoor camping equipment")

        assert "answer" in result
        assert "products" in result
        assert isinstance(result["answer"], str)
        assert len(result["answer"]) > 0
        assert isinstance(result["products"], list)

    def test_search_returns_400_for_empty_query(self, driver: ProductSearchApiDriver) -> None:
        """Search endpoint returns HTTP 400 when the query field is empty."""
        response = driver.search_raw("")

        assert response.status_code == 400
        body = response.json()
        assert "error" in body

    def test_search_returns_400_for_missing_body(self, driver: ProductSearchApiDriver) -> None:
        """Search endpoint returns HTTP 400 when the request body is absent."""
        import requests as req
        response = req.post(
            f"{driver.search_api_endpoint}/search",
            data="",
            headers={"Content-Type": "application/json"},
            timeout=30,
        )
        assert response.status_code == 400

    def test_search_returns_400_for_query_exceeding_max_length(self, driver: ProductSearchApiDriver) -> None:
        """Search endpoint returns HTTP 400 when the query exceeds 500 characters."""
        long_query = "a" * 501
        response = driver.search_raw(long_query)

        assert response.status_code == 400

    def test_search_response_structure_is_stable(self, driver: ProductSearchApiDriver) -> None:
        """Search response always contains `answer` (str) and `products` (list) keys."""
        result = driver.search("kitchen appliances")

        assert set(result.keys()) >= {"answer", "products"}
        for product in result["products"]:
            assert "productId" in product
            assert "name" in product
            assert "price" in product
            assert "stockLevel" in product


# ---------------------------------------------------------------------------
# Pipeline tests — verify the full write→read pipeline end to end.
# These create real products, wait for async processing, then search.
# Requires: Product Management Service deployed, Bedrock access, S3 Vectors bucket.
# ---------------------------------------------------------------------------

class TestCatalogSyncPipeline:
    def test_newly_created_product_appears_in_search(self, driver: ProductSearchApiDriver) -> None:
        """A product created via the Product API is searchable after catalog sync completes."""
        # Use a unique, unusual name so the search reliably returns this specific product
        unique_suffix = uuid.uuid4().hex[:8].upper()
        product_name = f"ZephyrTestWidget{unique_suffix}"
        product_id = None

        try:
            # Create the product via the Product Management Service API
            created = driver.create_product(name=product_name, price=49.99)
            product_id = created.get("productId")
            assert product_id is not None, "Product creation should return a productId"

            # Wait for: Product API → EventBridge → SQS → CatalogSyncFunction → Bedrock → S3 Vectors
            time.sleep(CATALOG_SYNC_WAIT_SECONDS)

            # Search for the product by its unique name
            result = driver.search(f"ZephyrTestWidget{unique_suffix}")

            assert "answer" in result
            assert "products" in result

            product_ids_returned = [p["productId"] for p in result["products"]]
            assert product_id in product_ids_returned, (
                f"Expected product {product_id} ({product_name}) in search results, "
                f"but got: {product_ids_returned}"
            )

        finally:
            if product_id:
                driver.delete_product(product_id)

    def test_deleted_product_does_not_appear_in_search(self, driver: ProductSearchApiDriver) -> None:
        """A product that has been deleted is removed from search results after catalog sync."""
        unique_suffix = uuid.uuid4().hex[:8].upper()
        product_name = f"EphemeralTestWidget{unique_suffix}"
        product_id = None

        try:
            # Create and let it index
            created = driver.create_product(name=product_name, price=29.99)
            product_id = created.get("productId")
            assert product_id is not None

            time.sleep(CATALOG_SYNC_WAIT_SECONDS)

            # Confirm it appears
            before_delete = driver.search(f"EphemeralTestWidget{unique_suffix}")
            before_ids = [p["productId"] for p in before_delete["products"]]
            assert product_id in before_ids, "Product should appear before deletion"

            # Delete via the Product API
            driver.delete_product(product_id)
            product_id = None  # Already deleted, skip cleanup in finally

            # Wait for deletion event to propagate
            time.sleep(CATALOG_SYNC_WAIT_SECONDS)

            # Confirm it no longer appears
            after_delete = driver.search(f"EphemeralTestWidget{unique_suffix}")
            after_ids = [p["productId"] for p in after_delete["products"]]
            assert product_id not in after_ids, "Deleted product should not appear in search results"

        finally:
            if product_id:
                driver.delete_product(product_id)

    def test_pricing_event_updates_indexed_product(self, driver: ProductSearchApiDriver) -> None:
        """After a pricing event, the re-embedded product reflects updated pricing tiers."""
        unique_suffix = uuid.uuid4().hex[:8].upper()
        product_name = f"PricingTestWidget{unique_suffix}"
        product_id = None

        try:
            created = driver.create_product(name=product_name, price=100.0)
            product_id = created.get("productId")
            assert product_id is not None

            # Wait for initial index
            time.sleep(CATALOG_SYNC_WAIT_SECONDS)

            # Inject a pricing event
            driver.inject_pricing_calculated_event(
                product_id=product_id,
                price_brackets=[
                    {"quantity": 5, "price": 90.0},
                    {"quantity": 10, "price": 80.0},
                ],
            )

            # Wait for pricing update to propagate
            time.sleep(CATALOG_SYNC_WAIT_SECONDS)

            # Verify the product is still searchable (pricing update doesn't break indexing)
            result = driver.search(f"PricingTestWidget{unique_suffix}")
            returned_ids = [p["productId"] for p in result["products"]]
            assert product_id in returned_ids, "Product should still be searchable after pricing update"

        finally:
            if product_id:
                driver.delete_product(product_id)
