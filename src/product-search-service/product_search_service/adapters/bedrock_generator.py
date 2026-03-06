from __future__ import annotations

import json
import time

import boto3
from botocore.exceptions import ClientError
from ddtrace.llmobs import LLMObs

from product_search_service.models.product import ProductMetadata

SYSTEM_PROMPT = """You are a helpful product assistant for an e-commerce store.
Answer the customer's question using only the products provided.
Be concise and specific. If no products match clearly, say so.
Do not invent products or details not in the provided list."""

RETRIABLE_ERROR_CODES = {"ThrottlingException", "ModelTimeoutException", "ServiceUnavailableException", "RequestTimeout"}
MAX_RETRIES = 3


class BedrockGenerator:
    """Generates natural language answers grounded in retrieved products via Claude on Bedrock."""

    def __init__(self, model_id: str = "anthropic.claude-3-5-haiku-20241022-v1:0") -> None:
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

    def generate_answer(self, query: str, products: list[ProductMetadata]) -> str:
        """Generate a grounded natural language answer with LLMObs instrumentation."""
        context_lines = []
        for p in products:
            tiers = "; ".join(
                f"Buy {t.quantity}+ for ${t.price:.2f}" for t in p.pricing_tiers
            )
            tier_str = f" Pricing tiers: {tiers}." if tiers else ""
            context_lines.append(
                f"- {p.name}: ${p.price:.2f} ({p.stock_level:.0f} in stock).{tier_str}"
            )
        context = (
            "\n".join(context_lines) if context_lines else "No products available."
        )

        # The 500-character query limit and system prompt grounding ("using only the products provided")
        # are the accepted mitigations for prompt injection. The user query is not further sanitised.
        # If stricter isolation is needed, place the query in a separate conversation turn or use
        # Bedrock Guardrails with the PII/content filter enabled.
        user_content = f"Customer question: {query}\n\nAvailable products:\n{context}"
        messages = [{"role": "user", "content": user_content}]

        with LLMObs.llm(model_name=self._model_id, model_provider="anthropic", name="bedrock.generate"):
            response = self._invoke_with_retry(
                modelId=self._model_id,
                body=json.dumps(
                    {
                        "anthropic_version": "bedrock-2023-05-31",
                        "max_tokens": 512,
                        "system": SYSTEM_PROMPT,
                        "messages": messages,
                    }
                ),
                contentType="application/json",
                accept="application/json",
            )
            body = json.loads(response["body"].read())
            answer: str = body["content"][0]["text"]
            usage = body.get("usage", {})

            LLMObs.annotate(
                input_data=messages,
                output_data=[{"role": "assistant", "content": answer}],
                metadata={
                    "usage": {
                        "input_tokens": usage.get("input_tokens", 0),
                        "output_tokens": usage.get("output_tokens", 0),
                    },
                    "system": SYSTEM_PROMPT,
                },
            )
            return answer
