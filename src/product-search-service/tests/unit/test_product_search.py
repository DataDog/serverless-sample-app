from __future__ import annotations

import json
from unittest.mock import MagicMock, patch

# Patch the ddtrace LLMObs workflow decorator before the handler module is imported
# so tests work without a running ddtrace agent.
with patch("ddtrace.llmobs.decorators.workflow", lambda **kw: lambda f: f):
    from product_search_service.handlers.product_search import lambda_handler

from product_search_service.models.product import ProductMetadata, ProductSummary, SearchResponse


def make_api_event(query: str) -> dict:
    """Build a minimal API Gateway proxy event with the given query."""
    return {
        "body": json.dumps({"query": query}),
        "headers": {"Content-Type": "application/json"},
        "requestContext": {},
    }


def make_product_metadata(
    product_id: str = "PROD1",
    name: str = "Test Product",
    price: float = 29.99,
    stock_level: float = 10.0,
    pricing_tiers: list | None = None,
    last_updated_at: str = "2026-01-01",
    embedding_model: str = "amazon.titan-embed-text-v2:0",
) -> ProductMetadata:
    """Factory for ProductMetadata test instances."""
    return ProductMetadata(
        product_id=product_id,
        name=name,
        price=price,
        stock_level=stock_level,
        pricing_tiers=pricing_tiers if pricing_tiers is not None else [],
        last_updated_at=last_updated_at,
        embedding_model=embedding_model,
    )


@patch("product_search_service.handlers.product_search._get_embedder")
@patch("product_search_service.handlers.product_search._get_vector_repo")
@patch("product_search_service.handlers.product_search._get_metadata_repo")
@patch("product_search_service.handlers.product_search._get_generator")
def test_search_returns_answer_and_products(
    mock_generator, mock_metadata, mock_vector, mock_embedder
):
    """Full pipeline should return an answer and correctly shaped products list."""
    mock_embedder.return_value.embed.return_value = [0.1] * 1024
    mock_vector.return_value.query.return_value = [("PROD1", 0.95), ("PROD2", 0.87)]
    mock_metadata.return_value.batch_get.return_value = [
        make_product_metadata(product_id="PROD1", name="Test Product"),
    ]
    mock_generator.return_value.generate_answer.return_value = "I recommend Test Product..."

    result = lambda_handler(make_api_event("outdoor products under £50"), MagicMock())

    assert result["statusCode"] == 200
    body = json.loads(result["body"])
    assert "answer" in body
    assert "products" in body
    assert len(body["products"]) == 1
    assert body["products"][0]["productId"] == "PROD1"
    assert body["answer"] == "I recommend Test Product..."


@patch("product_search_service.handlers.product_search._get_embedder")
@patch("product_search_service.handlers.product_search._get_vector_repo")
@patch("product_search_service.handlers.product_search._get_metadata_repo")
@patch("product_search_service.handlers.product_search._get_generator")
def test_search_with_no_matching_products(
    mock_generator, mock_metadata, mock_vector, mock_embedder
):
    """When vector search returns no matches, generator is still called with empty list and response has empty products."""
    mock_embedder.return_value.embed.return_value = [0.0] * 1024
    mock_vector.return_value.query.return_value = []
    mock_generator.return_value.generate_answer.return_value = "No products found for your query."

    result = lambda_handler(make_api_event("something obscure"), MagicMock())

    assert result["statusCode"] == 200
    body = json.loads(result["body"])
    assert body["answer"] == "No products found for your query."
    assert body["products"] == []

    mock_metadata.return_value.batch_get.assert_not_called()
    mock_generator.return_value.generate_answer.assert_called_once_with(
        "something obscure", []
    )


def test_missing_body_returns_400():
    """Event with no body should return 400."""
    event = {"headers": {}, "requestContext": {}}
    result = lambda_handler(event, MagicMock())

    assert result["statusCode"] == 400
    body = json.loads(result["body"])
    assert "error" in body


def test_empty_query_returns_400():
    """Event with an empty query string should return 400."""
    event = {"body": json.dumps({"query": ""}), "headers": {}, "requestContext": {}}
    result = lambda_handler(event, MagicMock())

    assert result["statusCode"] == 400
    body = json.loads(result["body"])
    assert "error" in body


def test_query_too_long_returns_400():
    """Query exceeding 500 characters should return 400."""
    long_query = "a" * 501
    result = lambda_handler(make_api_event(long_query), MagicMock())

    assert result["statusCode"] == 400
    body = json.loads(result["body"])
    assert "error" in body


def test_invalid_json_body_returns_400():
    """Non-JSON body should return 400."""
    event = {"body": "not json", "headers": {}, "requestContext": {}}
    result = lambda_handler(event, MagicMock())

    assert result["statusCode"] == 400
    body = json.loads(result["body"])
    assert "error" in body


@patch("product_search_service.handlers.product_search._get_embedder")
def test_bedrock_failure_returns_503(mock_embedder):
    """When the embedder raises an exception, the handler should return 503."""
    mock_embedder.return_value.embed.side_effect = RuntimeError("Bedrock unavailable")

    result = lambda_handler(make_api_event("any query"), MagicMock())

    assert result["statusCode"] == 503
    body = json.loads(result["body"])
    assert "error" in body


@patch("product_search_service.handlers.product_search._get_embedder")
def test_bedrock_failure_tags_span_as_error(mock_embedder):
    """When the RAG pipeline raises, the current span should be tagged as errored."""
    mock_embedder.return_value.embed.side_effect = RuntimeError("Bedrock unavailable")

    mock_span = MagicMock()
    with patch("product_search_service.handlers.product_search.tracer") as mock_tracer:
        mock_tracer.current_span.return_value = mock_span
        result = lambda_handler(make_api_event("any query"), MagicMock())

    assert result["statusCode"] == 503
    assert isinstance(mock_span, MagicMock)  # ensure it is a MagicMock
    assert mock_tracer.current_span.called
    mock_span.set_tag.assert_any_call("error.message", "Bedrock unavailable")
    mock_span.set_tag.assert_any_call("error.type", "RuntimeError")


@patch("product_search_service.handlers.product_search._get_embedder")
@patch("product_search_service.handlers.product_search._get_vector_repo")
@patch("product_search_service.handlers.product_search._get_metadata_repo")
@patch("product_search_service.handlers.product_search._get_generator")
def test_response_structure_matches_schema(
    mock_generator, mock_metadata, mock_vector, mock_embedder
):
    """Response body should deserialise cleanly into SearchResponse with correct field types."""
    mock_embedder.return_value.embed.return_value = [0.5] * 1024
    mock_vector.return_value.query.return_value = [("PROD42", 0.99)]
    mock_metadata.return_value.batch_get.return_value = [
        make_product_metadata(product_id="PROD42", name="Widget", price=9.99, stock_level=5.0),
    ]
    mock_generator.return_value.generate_answer.return_value = "Widget is a great choice."

    result = lambda_handler(make_api_event("affordable widgets"), MagicMock())

    assert result["statusCode"] == 200

    raw = json.loads(result["body"])
    response = SearchResponse.model_validate(raw)

    assert isinstance(response.answer, str)
    assert len(response.products) == 1

    product = response.products[0]
    assert isinstance(product, ProductSummary)
    assert product.product_id == "PROD42"
    assert product.name == "Widget"
    assert product.price == 9.99
    assert product.stock_level == 5.0
