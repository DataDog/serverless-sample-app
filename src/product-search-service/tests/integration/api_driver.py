from __future__ import annotations

import json
import os
import random
import string
from datetime import datetime, timedelta, timezone
from typing import Any

import boto3
import jwt
import requests


class ProductSearchApiDriver:
    """Test driver for the product-search-service integration tests.

    Discovers the search API endpoint and EventBridge bus from SSM Parameter Store,
    matching the pattern used by the activity-service integration tests.
    """

    def __init__(self, search_api_endpoint: str, product_api_endpoint: str, event_bus_name: str, jwt_secret: str = "") -> None:
        self.search_api_endpoint = search_api_endpoint.rstrip("/")
        self.product_api_endpoint = product_api_endpoint.rstrip("/")
        self.event_bus_name = event_bus_name
        self.environment = os.environ.get("ENV", "dev")
        self._jwt_secret = jwt_secret
        self._events_client = boto3.client("events")
        self._products_client = requests.Session()

    # ------------------------------------------------------------------
    # Search API
    # ------------------------------------------------------------------

    def search(self, query: str) -> dict[str, Any]:
        """POST /search with a natural language query."""
        response = self._products_client.post(
            f"{self.search_api_endpoint}/search",
            json={"query": query},
            timeout=30,
        )
        response.raise_for_status()
        return response.json()  # type: ignore[no-any-return]

    def search_raw(self, query: str) -> requests.Response:
        """POST /search and return the raw response (for asserting on status codes)."""
        return self._products_client.post(
            f"{self.search_api_endpoint}/search",
            json={"query": query},
            timeout=30,
        )

    # ------------------------------------------------------------------
    # Product Management Service API (used to seed test products)
    # ------------------------------------------------------------------

    def _generate_admin_token(self) -> str:
        """Generate a short-lived ADMIN JWT signed with the shared secret.

        The Product Management Service validates:
        - HS256 signing algorithm
        - `user_type` claim must equal "ADMIN"
        - Token must not be expired
        See: src/product-management-service/src/product-api/internal/adapters/authentication.go
        """
        now = datetime.now(timezone.utc)
        payload = {
            "sub": "admin@serverless-sample.com",
            "user_type": "ADMIN",
            "iat": now,
            "exp": now + timedelta(hours=1),
        }
        return jwt.encode(payload, self._jwt_secret, algorithm="HS256")

    def create_product(self, name: str, price: float) -> dict[str, Any]:
        """Create a product via the Product Management Service API."""
        headers = {}
        if self._jwt_secret:
            headers["Authorization"] = f"Bearer {self._generate_admin_token()}"
        response = self._products_client.post(
            f"{self.product_api_endpoint}/product",
            json={"name": name, "price": price},
            headers=headers,
            timeout=10,
        )
        response.raise_for_status()
        return response.json()  # type: ignore[no-any-return]

    def delete_product(self, product_id: str) -> None:
        """Delete a product via the Product Management Service API."""
        headers = {}
        if self._jwt_secret:
            headers["Authorization"] = f"Bearer {self._generate_admin_token()}"
        response = self._products_client.delete(
            f"{self.product_api_endpoint}/product/{product_id}",
            headers=headers,
            timeout=10,
        )
        # 404 on cleanup is acceptable
        if response.status_code not in (200, 204, 404):
            response.raise_for_status()

    # ------------------------------------------------------------------
    # EventBridge event injection (for catalog sync tests)
    # ------------------------------------------------------------------

    def inject_product_created_event(self, product_id: str) -> None:
        """Inject a product.productCreated.v1 event directly onto the shared EventBridge bus."""
        self._put_event(
            source=f"{self.environment}.products",
            detail_type="product.productCreated.v1",
            data={"productId": product_id},
        )

    def inject_product_updated_event(self, product_id: str) -> None:
        """Inject a product.productUpdated.v1 event directly onto the shared EventBridge bus."""
        self._put_event(
            source=f"{self.environment}.products",
            detail_type="product.productUpdated.v1",
            data={"productId": product_id},
        )

    def inject_product_deleted_event(self, product_id: str) -> None:
        """Inject a product.productDeleted.v1 event directly onto the shared EventBridge bus."""
        self._put_event(
            source=f"{self.environment}.products",
            detail_type="product.productDeleted.v1",
            data={"productId": product_id},
        )

    def inject_pricing_calculated_event(self, product_id: str, price_brackets: list[dict[str, Any]]) -> None:
        """Inject a pricing.pricingCalculated.v1 event directly onto the shared EventBridge bus."""
        self._put_event(
            source=f"{self.environment}.pricing",
            detail_type="pricing.pricingCalculated.v1",
            data={"productId": product_id, "priceBrackets": price_brackets},
        )

    def inject_stock_updated_event(self, product_id: str, stock_level: float) -> None:
        """Inject an inventory.stockUpdated.v1 event directly onto the shared EventBridge bus."""
        self._put_event(
            source=f"{self.environment}.inventory",
            detail_type="inventory.stockUpdated.v1",
            data={"productId": product_id, "stockLevel": stock_level},
        )

    def _put_event(self, source: str, detail_type: str, data: dict[str, Any]) -> None:
        cloud_event = {
            "specversion": "1.0",
            "type": detail_type,
            "source": source,
            "id": _generate_id(),
            "time": datetime.now(timezone.utc).isoformat(),
            "datacontenttype": "application/json",
            "data": data,
        }
        self._events_client.put_events(
            Entries=[{
                "Source": source,
                "DetailType": detail_type,
                "Detail": json.dumps(cloud_event),
                "EventBusName": self.event_bus_name,
            }]
        )


def _generate_id() -> str:
    return "".join(random.choices(string.ascii_lowercase + string.digits, k=12))


INTEGRATED_ENVIRONMENTS = ["dev", "prod"]


def initialize_driver() -> ProductSearchApiDriver:
    """Resolve service endpoints and return an initialised driver.

    Checks ENV vars first (for local overrides), then falls back to SSM discovery.
    Shared parameters (event bus, product service endpoint) only exist for dev/prod;
    ephemeral (commit-hash) environments skip those lookups.
    """
    search_endpoint = os.environ.get("SEARCH_API_ENDPOINT")
    product_endpoint = os.environ.get("PRODUCT_API_ENDPOINT")
    event_bus_name = os.environ.get("EVENT_BUS_NAME")
    jwt_secret = os.environ.get("JWT_SECRET_KEY", "")

    if search_endpoint and product_endpoint and event_bus_name:
        return ProductSearchApiDriver(search_endpoint, product_endpoint, event_bus_name, jwt_secret)

    env = os.environ.get("ENV", "dev")
    ssm = boto3.client("ssm")

    search_endpoint = ssm.get_parameter(
        Name=f"/{env}/ProductSearchService/api-endpoint"
    )["Parameter"]["Value"]

    if env in INTEGRATED_ENVIRONMENTS:
        try:
            product_endpoint = ssm.get_parameter(
                Name=f"/{env}/ProductService/api-endpoint"
            )["Parameter"]["Value"]
        except ssm.exceptions.ParameterNotFound:
            # Product Management Service may not be deployed in this region/account.
            # Smoke tests don't need this; pipeline tests will fail explicitly if called.
            product_endpoint = ""
        try:
            event_bus_name = ssm.get_parameter(
                Name=f"/{env}/shared/event-bus-name"
            )["Parameter"]["Value"]
        except ssm.exceptions.ParameterNotFound:
            event_bus_name = "default"
        try:
            jwt_secret = ssm.get_parameter(
                Name=f"/{env}/shared/secret-access-key",
                WithDecryption=True,
            )["Parameter"]["Value"]
        except ssm.exceptions.ParameterNotFound:
            jwt_secret = ""
    else:
        # Product Management Service and shared event bus are not deployed in ephemeral envs.
        # Pipeline tests are skipped; smoke tests only need the search endpoint.
        product_endpoint = ""
        event_bus_name = "default"

    return ProductSearchApiDriver(search_endpoint, product_endpoint, event_bus_name, jwt_secret)
