from __future__ import annotations

import json
import time

import boto3
from botocore.exceptions import ClientError
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
                    sleep_seconds = 0.1 * (2 ** attempt)  # 0.1s, 0.2s, 0.4s
                    time.sleep(sleep_seconds)
                    continue
                raise

    def embed(self, text: str) -> list[float]:
        """Generate embedding using Titan Embeddings V2 with LLMObs instrumentation."""
        with LLMObs.embedding(model_name=self._model_id, model_provider="amazon", name="bedrock.embed"):
            response = self._invoke_with_retry(
                modelId=self._model_id,
                body=json.dumps({"inputText": text}),
                contentType="application/json",
                accept="application/json",
            )
            body = json.loads(response["body"].read())
            embedding_vector: list[float] = body["embedding"]
            token_count: int = body.get("inputTextTokenCount", 0)

            LLMObs.annotate(
                input_data=[{"text": text}],
                output_data=[{"embedding": embedding_vector}],
                metadata={"usage": {"input_tokens": token_count}},
            )
            return embedding_vector
