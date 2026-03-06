from __future__ import annotations

import boto3
import requests
from aws_lambda_powertools import Logger
from botocore.config import Config

from product_search_service.models.product import ProductMetadata, PricingTier

logger = Logger()


class ProductApiClient:
    """HTTP client that fetches product details from the Product Management Service.

    The service endpoint URL is discovered lazily from AWS SSM Parameter Store.
    """

    def __init__(self, endpoint_parameter: str) -> None:
        self._ssm = boto3.client(
            "ssm",
            config=Config(connect_timeout=2, read_timeout=5, retries={"max_attempts": 2}),
        )
        self._endpoint_parameter = endpoint_parameter
        self._base_url: str | None = None

    def _get_base_url(self) -> str:
        """Resolve and cache the Product Management Service base URL from SSM.

        Returns:
            The base URL string with any trailing slash stripped.
        """
        if self._base_url is None:
            response = self._ssm.get_parameter(Name=self._endpoint_parameter)
            self._base_url = response["Parameter"]["Value"].rstrip("/")
        return self._base_url

    def get_product(self, product_id: str) -> ProductMetadata | None:
        """Fetch full product details from the Product Management Service.

        Args:
            product_id: The unique product identifier to look up.

        Returns:
            A ``ProductMetadata`` instance, or ``None`` if the product does not
            exist or the request fails.
        """
        try:
            url = f"{self._get_base_url()}/product/{product_id}"
            response = requests.get(url, timeout=5)
            if response.status_code == 404:
                logger.info("Product not found in upstream API", product_id=product_id)
                return None  # Permanent — do not retry
            response.raise_for_status()  # Raises for 4xx/5xx — caller retries via SQS
            data = response.json()
            return ProductMetadata(
                product_id=data["productId"],
                name=data["name"],
                price=float(data["price"]),
                stock_level=float(data.get("stockLevel", 0)),
                pricing_tiers=[
                    PricingTier(quantity=t["quantity"], price=float(t["price"]))
                    for t in data.get("pricingBrackets", [])
                ],
                last_updated_at=data.get("lastUpdatedAt", ""),
            )
        except requests.HTTPError as e:
            logger.exception("Product API returned an error", product_id=product_id, status_code=e.response.status_code if e.response else None)
            raise  # Let caller decide: non-404 HTTP errors should retry
        except Exception:
            logger.exception("Failed to fetch product from API", product_id=product_id)
            raise  # Raise so SQS can retry — do not swallow transient failures
