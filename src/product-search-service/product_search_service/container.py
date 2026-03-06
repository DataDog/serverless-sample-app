from __future__ import annotations

import os

from product_search_service.adapters.bedrock_embedder import BedrockEmbedder
from product_search_service.adapters.bedrock_generator import BedrockGenerator
from product_search_service.adapters.metadata_repository import MetadataRepository
from product_search_service.adapters.product_api_client import ProductApiClient
from product_search_service.adapters.vector_repository import VectorRepository

_embedder: BedrockEmbedder | None = None
_generator: BedrockGenerator | None = None
_vector_repo: VectorRepository | None = None
_metadata_repo: MetadataRepository | None = None
_product_api: ProductApiClient | None = None


def get_embedder() -> BedrockEmbedder:
    """Return the shared BedrockEmbedder, initialising on first call."""
    global _embedder
    if _embedder is None:
        _embedder = BedrockEmbedder(model_id=os.environ.get("EMBEDDING_MODEL_ID", "amazon.titan-embed-text-v2:0"))
    return _embedder


def get_generator() -> BedrockGenerator:
    """Return the shared BedrockGenerator, initialising on first call."""
    global _generator
    if _generator is None:
        _generator = BedrockGenerator(model_id=os.environ.get("GENERATION_MODEL_ID", "anthropic.claude-3-5-haiku-20241022-v1:0"))
    return _generator


def get_vector_repo() -> VectorRepository:
    """Return the shared VectorRepository, initialising on first call."""
    global _vector_repo
    if _vector_repo is None:
        _vector_repo = VectorRepository(bucket_name=os.environ.get("VECTOR_BUCKET_NAME", "serverless-sample-app-vector-dev"))
    return _vector_repo


def get_metadata_repo() -> MetadataRepository:
    """Return the shared MetadataRepository, initialising on first call."""
    global _metadata_repo
    if _metadata_repo is None:
        _metadata_repo = MetadataRepository(table_name=os.environ.get("METADATA_TABLE_NAME", "product-search-metadata"))
    return _metadata_repo


def get_product_api() -> ProductApiClient:
    """Return the shared ProductApiClient, initialising on first call."""
    global _product_api
    if _product_api is None:
        _product_api = ProductApiClient(
            endpoint_parameter=os.environ.get("PRODUCT_API_ENDPOINT_PARAMETER", "/dev/ProductManagementService/api-endpoint")
        )
    return _product_api
