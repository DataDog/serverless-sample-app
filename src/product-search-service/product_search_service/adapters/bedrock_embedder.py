from __future__ import annotations

import json
import time

import boto3
from botocore.exceptions import ClientError
from ddtrace import tracer
from ddtrace.llmobs import LLMObs

RETRIABLE_ERROR_CODES = {"ThrottlingException", "ModelTimeoutException", "ServiceUnavailableException", "RequestTimeout"}
MAX_RETRIES = 3


class BedrockEmbedder:
    """Generates text embeddings via Amazon Titan Embeddings V2 on Bedrock."""

    def __init__(self, model_id: str = "amazon.titan-embed-text-v2:0") -> None:
        self._client = boto3.client("bedrock-runtime")
        self._model_id = model_id

    def _invoke_with_retry(self, **kwargs) -> dict:
        """Invoke Bedrock model with exponential backoff on retriable errors."""
        for attempt in range(MAX_RETRIES):
            try:
                return self._client.invoke_model(**kwargs)
            except ClientError as e:
                code = e.response["Error"]["Code"]
                if code in RETRIABLE_ERROR_CODES and attempt < MAX_RETRIES - 1:
                    sleep_seconds = 0.1 * (2 ** attempt)
                    time.sleep(sleep_seconds)
                    continue
                raise

    def embed(self, text: str) -> list[float]:
        """Generate embedding using Titan Embeddings V2.

        Instruments the span with full OTel GenAI semantic conventions:
        https://opentelemetry.io/docs/specs/semconv/gen-ai/gen-ai-spans/

        Span name follows the convention: "{gen_ai.operation.name} {gen_ai.request.model}"
        """
        span_name = f"embeddings {self._model_id}"

        with LLMObs.embedding(model_name=self._model_id, model_provider="aws.bedrock", name=span_name):
            span = tracer.current_span()

            # Required attributes
            if span:
                span.set_tag("gen_ai.operation.name", "embeddings")
                span.set_tag("gen_ai.provider.name", "aws.bedrock")
                span.set_tag("gen_ai.request.model", self._model_id)

            try:
                response = self._invoke_with_retry(
                    modelId=self._model_id,
                    body=json.dumps({"inputText": text}),
                    contentType="application/json",
                    accept="application/json",
                )
                body = json.loads(response["body"].read())
                embedding_vector: list[float] = body["embedding"]
                token_count: int = body.get("inputTextTokenCount", 0)

                # Recommended attributes
                if span:
                    span.set_tag("gen_ai.response.model", self._model_id)
                    span.set_tag("gen_ai.usage.input_tokens", token_count)
                    span.set_tag("gen_ai.embeddings.dimension.count", len(embedding_vector))

                LLMObs.annotate(
                    input_data=[{"text": text}],
                    output_data=[{"embedding": embedding_vector}],
                    metadata={"usage": {"input_tokens": token_count}},
                )
                return embedding_vector

            except Exception as e:
                if span:
                    span.set_tag("error.type", type(e).__name__)
                raise
