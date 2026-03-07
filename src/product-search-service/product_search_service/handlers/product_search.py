from __future__ import annotations

import json
import os
from typing import Any

from aws_lambda_powertools import Logger
from aws_lambda_powertools.utilities.typing import LambdaContext
from ddtrace import tracer
from ddtrace.llmobs.decorators import workflow

from product_search_service.adapters.bedrock_embedder import BedrockEmbedder
from product_search_service.adapters.bedrock_generator import BedrockGenerator
from product_search_service.adapters.metadata_repository import MetadataRepository
from product_search_service.adapters.vector_repository import VectorRepository
from product_search_service.models.product import ProductSummary, SearchResponse

logger = Logger()
tracer.set_tags({"domain": "product-search", "team": "product-search"})

_embedder: BedrockEmbedder | None = None
_generator: BedrockGenerator | None = None
_vector_repo: VectorRepository | None = None
_metadata_repo: MetadataRepository | None = None


def _get_embedder() -> BedrockEmbedder:
    """Return the singleton BedrockEmbedder, initialising it on first call."""
    global _embedder
    if _embedder is None:
        model_id = os.environ.get("EMBEDDING_MODEL_ID", "amazon.titan-embed-text-v2:0")
        _embedder = BedrockEmbedder(model_id=model_id)
    return _embedder


def _get_generator() -> BedrockGenerator:
    """Return the singleton BedrockGenerator, initialising it on first call."""
    global _generator
    if _generator is None:
        model_id = os.environ.get("GENERATION_MODEL_ID", "anthropic.claude-3-5-haiku-20241022-v1:0")
        _generator = BedrockGenerator(model_id=model_id)
    return _generator


def _get_vector_repo() -> VectorRepository:
    """Return the singleton VectorRepository, initialising it on first call."""
    global _vector_repo
    if _vector_repo is None:
        bucket_name = os.environ.get("VECTOR_BUCKET_NAME", "serverless-sample-app-vector-dev")
        _vector_repo = VectorRepository(bucket_name=bucket_name)
    return _vector_repo


def _get_metadata_repo() -> MetadataRepository:
    """Return the singleton MetadataRepository, initialising it on first call."""
    global _metadata_repo
    if _metadata_repo is None:
        table_name = os.environ.get("METADATA_TABLE_NAME", "product-search-metadata")
        _metadata_repo = MetadataRepository(table_name=table_name)
    return _metadata_repo


@logger.inject_lambda_context
def lambda_handler(event: dict[str, Any], context: LambdaContext) -> dict[str, Any]:
    """Handle POST /search — run the full RAG pipeline and return an AI-generated answer."""
    try:
        body = _parse_body(event)
        query = _extract_query(body)
    except ValueError as e:
        return _error_response(400, str(e))

    try:
        result = _run_rag_pipeline(query)
        return {
            "statusCode": 200,
            "headers": {"Content-Type": "application/json"},
            "body": result.model_dump_json(by_alias=True),
        }
    except Exception as e:
        span = tracer.current_span()
        if span:
            span.error = 1
            span.set_tag("error.message", str(e))
            span.set_tag("error.type", type(e).__name__)
        logger.exception("RAG pipeline failed")
        return _error_response(503, "service temporarily unavailable")


@workflow(name="product_search.rag_pipeline")
def _run_rag_pipeline(query: str) -> SearchResponse:
    """Execute the full RAG pipeline: embed → search → fetch → generate."""
    top_k = int(os.environ.get("SEARCH_TOP_K", "5"))

    query_embedding = _get_embedder().embed(query)

    matches = _get_vector_repo().query(query_embedding, top_k=top_k)
    product_ids = [product_id for product_id, _ in matches]

    products_unordered = _get_metadata_repo().batch_get(product_ids) if product_ids else []

    # Preserve vector similarity ranking
    product_map = {p.product_id: p for p in products_unordered}
    products = [product_map[pid] for pid in product_ids if pid in product_map]

    span = tracer.current_span()
    if span:
        span.set_tag("search.query_length", len(query))
        span.set_tag("search.top_k", top_k)
        span.set_tag("search.products_found", len(products))

    if not products:
        logger.info("No matching products found for query", query_length=len(query))

    answer = _get_generator().generate_answer(query, products)

    summaries = [
        ProductSummary(
            product_id=p.product_id,
            name=p.name,
            price=p.price,
            stock_level=p.stock_level,
        )
        for p in products
    ]

    logger.info(
        "Search completed",
        query_length=len(query),
        products_found=len(products),
    )

    return SearchResponse(answer=answer, products=summaries)


def _parse_body(event: dict[str, Any]) -> dict[str, Any]:
    """Parse the request body from the API Gateway event."""
    raw_body = event.get("body", "")
    if not raw_body:
        raise ValueError("request body is required")
    try:
        return json.loads(raw_body)  # type: ignore[no-any-return]
    except json.JSONDecodeError as e:
        raise ValueError("request body must be valid JSON") from e


def _extract_query(body: dict[str, Any]) -> str:
    """Extract and validate the query field from the parsed body."""
    query: str | None = body.get("query")
    if not query or not query.strip():
        raise ValueError("query is required and must not be empty")
    if len(query) > 500:
        raise ValueError("query must not exceed 500 characters")
    return query.strip()


def _error_response(status_code: int, message: str) -> dict[str, Any]:
    """Build a standard error response dict for API Gateway."""
    return {
        "statusCode": status_code,
        "headers": {"Content-Type": "application/json"},
        "body": json.dumps({"error": message}),
    }
