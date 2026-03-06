# Code Review: product-search-service

**Generated**: 2026-03-06
**Agents**: 6 (parallel execution)
**Scope**: All application code, CDK stack, unit tests

---

## Recommendation: ⚠️ Approve with changes

The service is structurally sound — dependency direction is correct, no circular imports, SQS partial batch failure is correctly implemented, DSM checkpoints and span links are correctly wired. The core demonstration value (RAG pipeline on Lambda with Bedrock + S3 Vectors) is achieved.

However, there are **6 critical issues** where the primary demo goal — "see the full LLM pipeline in one Datadog trace" — is currently broken or would cause production-class silent failures before they are ever observed.

---

## Architecture Assessment

| Principle | Score | Notes |
|-----------|-------|-------|
| Evolvability | 3.5 / 5 | Registry pattern is excellent; vector store swap is well-isolated; adapter decorators and generator body are not |
| Encapsulation | 3 / 5 | Adapter boundaries are clean; `ProductMetadata` owns DynamoDB serialisation it should not |
| Coupling | 3 / 5 | Correct dependency direction; all modules A=0.00 (Zone of Pain); singleton factories duplicated |
| Understanding | 4 / 5 | Consistent with activity-service patterns; dual tracer in `product_search.py` is confusing |
| Failure Modes | 2 / 5 | Missing retry, missing DLQ alarm, silent data loss in partial write path |

---

## 🔴 Critical Issues (Must Fix)

### 1. LLMObs spans are orphaned from the APM trace — demo goal is broken

**Agent**: otel-tracing-reviewer
**Files**: `handlers/product_search.py` lines 7-20, 65

Two compounding problems:

**1a.** `product_search.py` imports and instantiates an AWS Lambda Powertools `Tracer` and uses `@tracer.capture_lambda_handler`. This creates an X-Ray root span, not a Datadog root span. The `dd_tracer` alias is a separate import applied after the fact.

**1b.** There is no `LLMObs.workflow()` or `LLMObs.agent()` context span wrapping `_run_rag_pipeline`. Without a parent LLMObs span, the `@embedding` and `@llm` decorated spans in the adapters are created as orphaned LLMObs roots with no connection to the surrounding APM trace.

Result: the core demo goal — "see the full RAG pipeline in one Datadog trace" — does not work.

**Fix**:
```python
# handlers/product_search.py — remove these lines:
from aws_lambda_powertools import Logger, Tracer   # remove Tracer
tracer = Tracer()                                   # remove entirely
@tracer.capture_lambda_handler                      # remove this decorator

# Keep and rename dd_tracer back to tracer:
from ddtrace import tracer
tracer.set_tags({"domain": "product-search", "team": "product-search"})

# Wrap the pipeline with an LLMObs workflow span:
from ddtrace.llmobs.decorators import workflow

@workflow(name="product_search.rag_pipeline")
def _run_rag_pipeline(query: str) -> SearchResponse:
    ...
```

---

### 2. Bedrock `ThrottlingException` has no retry — causes unnecessary DLQ accumulation

**Agent**: architecture-reviewer, failure-mode-analyst
**Files**: `adapters/bedrock_embedder.py` line 30, `adapters/bedrock_generator.py`
**FMEA RPN**: 240 (highest in the service)

Neither `BedrockEmbedder.embed` nor `BedrockGenerator.generate_answer` retries on `ThrottlingException`. A transient throttle causes the entire SQS record to fail all 3 `maxReceiveCount` attempts and land in the DLQ, where it must be manually replayed.

**Fix**: Wrap `invoke_model` calls in exponential backoff for retriable error codes:
```python
from botocore.exceptions import ClientError
import time

def _invoke_with_retry(self, **kwargs) -> dict:
    for attempt in range(3):
        try:
            return self._client.invoke_model(**kwargs)
        except ClientError as e:
            if e.response["Error"]["Code"] in ("ThrottlingException", "ModelTimeoutException") and attempt < 2:
                time.sleep(0.1 * (2 ** attempt))
                continue
            raise
```

---

### 3. No DLQ CloudWatch alarm — silent failure accumulation

**Agent**: failure-mode-analyst
**File**: `cdk/product_search_stack.py`
**FMEA RPN**: 224

The `CatalogSyncDLQ` is created but never monitored. Any sustained upstream failure (Bedrock throttle, Product API outage, S3 Vectors outage) fills the DLQ silently. After 14 days, messages are permanently deleted — products permanently missing from search with no operator alert.

**Fix**: Add to `product_search_stack.py`:
```python
from aws_cdk import aws_cloudwatch as cloudwatch

cloudwatch.Alarm(
    self, "CatalogSyncDLQAlarm",
    alarm_name=f"{SERVICE_NAME}-dlq-not-empty-{environment}",
    alarm_description="Messages in CatalogSync DLQ — catalog sync is failing",
    metric=catalog_sync_dlq.metric_approximate_number_of_messages_visible(),
    threshold=1,
    evaluation_periods=1,
    comparison_operator=cloudwatch.ComparisonOperator.GREATER_THAN_OR_EQUAL_TO_THRESHOLD,
)
```

---

### 4. `batch_get` infinite loop with no backoff — can spin to Lambda timeout

**Agent**: architecture-reviewer, failure-mode-analyst
**File**: `adapters/metadata_repository.py` lines 100-110
**FMEA RPN**: 126

The `while remaining_keys:` loop has no iteration cap and no sleep between retries. DynamoDB returning persistent `UnprocessedKeys` (during a brownout) causes the Lambda to spin until the 29-second timeout, then return a 504, while hammering DynamoDB and worsening the throttle.

**Fix**:
```python
MAX_BATCH_RETRIES = 5

while remaining_keys:
    if retry_count >= MAX_BATCH_RETRIES:
        logger.error("batch_get exceeded max retries", remaining_keys=len(remaining_keys))
        raise RuntimeError(f"DynamoDB batch_get failed after {MAX_BATCH_RETRIES} retries")
    if retry_count > 0:
        time.sleep(0.1 * (2 ** retry_count))
    retry_count += 1
    # ... existing batch_get_item call
```

---

### 5. `ProductApiClient` swallows all exceptions uniformly — 404 and 500 are indistinguishable

**Agent**: architecture-reviewer, failure-mode-analyst
**File**: `adapters/product_api_client.py` lines 44-49

All exceptions — including genuine 404 (product doesn't exist), network timeout, SSM failure, and upstream 500 — are caught by a single `except Exception` and return `None`. The handler in `catalog_sync.py` treats all `None` as "retry via SQS", meaning a genuine 404 is retried 3 times and then lands in the DLQ unnecessarily.

**Fix**: Distinguish permanent from transient failures:
```python
response = requests.get(url, timeout=5)
if response.status_code == 404:
    return None  # Permanent — product genuinely not found
response.raise_for_status()  # Raise on 5xx — caller will retry via SQS
```

---

### 6. SSM `get_parameter` has no timeout — silent Lambda hang possible

**Agent**: architecture-reviewer, failure-mode-analyst
**File**: `adapters/product_api_client.py` line 30

The boto3 SSM client has default timeouts of 60 seconds (connect) and 60 seconds (read). An SSM call at cold start can silently hang the Lambda for up to 120 seconds, which exceeds the 29-second Lambda timeout. The exception is swallowed by the broad `except Exception` in `get_product`, making the root cause invisible.

**Fix**:
```python
from botocore.config import Config

self._ssm = boto3.client("ssm", config=Config(connect_timeout=2, read_timeout=5))
```

Or eliminate the SSM runtime call entirely by resolving the endpoint at deploy time:
```python
# cdk/product_search_stack.py
product_api_endpoint = ssm.StringParameter.value_from_lookup(
    self, f"/{environment}/ProductManagementService/api-endpoint"
)
# Pass as env-var to CatalogSyncFunction: PRODUCT_API_ENDPOINT: product_api_endpoint
```

---

## 🟡 Important Issues (Should Fix)

### 7. `@llm` and `@embedding` decorator `model_name` arguments are hardcoded literals

**Agent**: otel-tracing-reviewer, evolvability-assessor
**Files**: `adapters/bedrock_embedder.py` line 17, `adapters/bedrock_generator.py` line 17

```python
@embedding(model_name="titan-embed-text-v2", model_provider="amazon")  # hardcoded
@llm(model_name="claude-3-5-haiku-20241022", model_provider="anthropic")  # hardcoded
```

When `GENERATION_MODEL_ID` or `EMBEDDING_MODEL_ID` is changed via environment variable, the LLMObs trace still reports the old hardcoded model name. A model switch would produce silently incorrect observability.

**Fix**: Remove the static decorators; call `LLMObs.annotate()` directly using `self._model_id`.

---

### 8. Errors are never recorded on spans

**Agent**: otel-tracing-reviewer
**Files**: `handlers/product_search.py` lines 74-76, `handlers/catalog_sync.py` exception paths

The `except Exception` block in `product_search.py` returns a 503 but never tags the current span as errored. Errors are invisible in APM even while users receive 503s.

**Fix**: In all exception handlers:
```python
except Exception as e:
    span = tracer.current_span()
    if span:
        span.error = 1
        span.set_tag("error.message", str(e))
        span.set_tag("error.type", type(e).__name__)
    logger.exception("RAG pipeline failed")
    return _error_response(503, "service temporarily unavailable")
```

---

### 9. `_run_rag_pipeline` has no span — pipeline steps are invisible

**Agent**: otel-tracing-reviewer
**File**: `handlers/product_search.py` line 79

The four pipeline steps (embed → vector search → DynamoDB → generate) appear as flat SDK spans with no named parent. There is no visibility into which step dominates latency.

**Fix**: Already covered by fixing Critical Issue #1 (adding `@workflow(name="product_search.rag_pipeline")`). Additionally, set business tags on the span:
```python
span = tracer.current_span()
if span:
    span.set_tag("search.query_length", len(query))
    span.set_tag("search.top_k", top_k)
    span.set_tag("search.products_found", len(products))
```

---

### 10. `VectorRepository.query` and `MetadataRepository.batch_get` have no spans

**Agent**: otel-tracing-reviewer
**Files**: `adapters/vector_repository.py`, `adapters/metadata_repository.py`

The S3 Vectors query is not an instrumented AWS SDK operation (too new for ddtrace contrib). The DynamoDB batch_get retry loop produces no span for individual retry iterations. Both are high-latency operations with no visibility.

**Fix**:
```python
@tracer.wrap(resource="vector_repository.query")
def query(self, embedding: list[float], top_k: int = 5) -> list[tuple[str, float]]:
    span = tracer.current_span()
    # ... existing code ...
    if span:
        span.set_tag("vector.top_k", top_k)
        span.set_tag("vector.matches_returned", len(results))
    return results

@tracer.wrap(resource="metadata_repository.batch_get")
def batch_get(self, product_ids: list[str]) -> list[ProductMetadata]:
    ...
```

---

### 11. DynamoDB + S3 Vectors can get out of sync after partial write — silent data loss

**Agent**: failure-mode-analyst, architecture-reviewer
**File**: `handlers/catalog_sync.py` lines 189-191
**FMEA RPN**: 224

`vector_repo.upsert` is called before `metadata_repo.upsert`. If the DynamoDB write fails, the vector exists but has no metadata. Future queries match the vector, but `batch_get` silently drops the product — it becomes unfindable with no error.

**Fix**: Reverse the write order (DynamoDB first — natural upsert idempotency):
```python
_get_metadata_repo().upsert(product)          # DynamoDB first — idempotent on retry
_get_vector_repo().upsert(product_id, ...)    # S3 Vectors second
```
And detect mismatches in the search path:
```python
if len(products) < len(product_ids):
    logger.warning("Vector/metadata mismatch", vectors=len(product_ids), resolved=len(products))
```

---

### 12. `pricing.pricingCalculated` and `inventory.stockUpdated` events are silently dropped when product not in cache

**Agent**: failure-mode-analyst
**File**: `handlers/catalog_sync.py` lines 297-303, 340-347
**FMEA RPN**: 175

When a pricing or stock event arrives before `productCreated` is processed (a realistic race condition), the handler logs a warning and returns — no retry, no error. The pricing tiers or stock level are permanently missing from the search index until the next `productUpdated` event heals state.

**Fix**: Retry instead of silently drop (but guard against infinite loops):
```python
existing = _get_metadata_repo().get(product_id)
if existing is None:
    receive_count = int(record.attributes.get("ApproximateReceiveCount", "1"))
    if receive_count <= 3:
        raise ValueError(f"Product {product_id} not yet in cache — retrying (attempt {receive_count})")
    logger.warning("Product not found after max retries, dropping pricing event", product_id=product_id)
    return
```

---

### 13. Duplicate singleton factories across both handlers

**Agent**: coupling-analyzer, architecture-reviewer, modularity-reviewer
**Files**: `handlers/catalog_sync.py` lines 36-78, `handlers/product_search.py` lines 22-61

The `_get_embedder()`, `_get_vector_repo()`, and `_get_metadata_repo()` functions — including their env-var names and defaults — are copy-pasted verbatim. A configuration change must be made in two files and will silently diverge.

**Fix**: Extract to `product_search_service/container.py`:
```python
# container.py
_embedder: BedrockEmbedder | None = None

def get_embedder() -> BedrockEmbedder:
    global _embedder
    if _embedder is None:
        _embedder = BedrockEmbedder(model_id=os.environ.get("EMBEDDING_MODEL_ID", "amazon.titan-embed-text-v2:0"))
    return _embedder
```

Both handler files then `from product_search_service.container import get_embedder`.

---

### 14. CDK Bedrock IAM ARNs hardcoded — diverge silently from env-vars on model change

**Agent**: evolvability-assessor, architecture-reviewer
**File**: `cdk/product_search_stack.py` lines 157, 221-222

The IAM policy resources hardcode `amazon.titan-embed-text-v2:0` and `anthropic.claude-3-5-haiku-20241022-v1:0` independently of the env-var values. A model change requires two edits in two different places; missing the IAM update causes a silent permission failure at runtime.

**Fix**: Derive the IAM ARN from the same variable:
```python
embedding_model_id = os.environ.get("EMBEDDING_MODEL_ID", "amazon.titan-embed-text-v2:0")
generation_model_id = os.environ.get("GENERATION_MODEL_ID", "anthropic.claude-3-5-haiku-20241022-v1:0")

# Use in both IAM policy and env-var:
resources=[f"arn:aws:bedrock:{self.region}::foundation-model/{embedding_model_id}"]
"EMBEDDING_MODEL_ID": embedding_model_id,
```

---

### 15. `messaging.system` tag is `"aws_sqs"` but should be `"eventbridge"`

**Agent**: otel-tracing-reviewer
**File**: `observability/messaging.py` line 34

The DSM `set_consume_checkpoint` correctly passes `"eventbridge"` as the system type. The span tag `messaging.system` sets `"aws_sqs"` — the two signals are inconsistent. Dashboards filtering on `messaging.system:eventbridge` will miss this service.

**Fix**: Change line 34 from `span.set_tag("messaging.system", "aws_sqs")` to `span.set_tag("messaging.system", "eventbridge")`.

---

### 16. `log_retention=RetentionDays.ONE_DAY` is too aggressive

**Agent**: architecture-reviewer, failure-mode-analyst
**File**: `cdk/product_search_stack.py` lines 289, 333

One-day log retention eliminates forensic evidence from overnight incidents. For a service where Bedrock generation prompts, responses, and costs need to be auditable, this is especially problematic.

**Fix**: Increase to at least `RetentionDays.ONE_WEEK` for dev, `RetentionDays.ONE_MONTH` for prod.

---

## 🟢 Suggestions (Nice to Have)

### 17. `batch_get` results are not ordered by vector similarity score

**Agent**: evolvability-assessor
**File**: `handlers/product_search.py` lines 94-99

`batch_get` returns DynamoDB items in arbitrary order. The generator receives products not ranked by relevance. The issue worsens as the catalogue grows.

```python
product_map = {p.product_id: p for p in products}
ordered_products = [product_map[pid] for pid, _ in matches if pid in product_map]
```

---

### 18. Add `is_remote=True` to span link `Context` constructor

**Agent**: otel-tracing-reviewer
**File**: `observability/messaging.py` lines 49-53

```python
linked_context = Context(trace_id=..., span_id=..., is_remote=True)
```

Without this flag, Datadog may not render the span link correctly in the UI.

---

### 19. Add Protocol/ABC interfaces for adapters

**Agent**: coupling-analyzer, modularity-reviewer, evolvability-assessor

All adapter modules have `A=0.00` (fully concrete, no abstractions), placing them in the Zone of Pain. Adding `typing.Protocol` definitions for `Embedder`, `Generator`, and `VectorStore` enables:
- Type-safe provider swaps without updating call sites
- Workshop mode stubs without replacing handler files
- In-process test doubles without `patch()` on private names

```python
# adapters/protocols.py
from typing import Protocol

class Embedder(Protocol):
    def embed(self, text: str) -> list[float]: ...

class VectorStore(Protocol):
    def upsert(self, product_id: str, embedding: list[float], metadata: dict[str, str]) -> None: ...
    def query(self, embedding: list[float], top_k: int) -> list[tuple[str, float]]: ...
    def delete(self, product_id: str) -> None: ...
```

---

### 20. Extract `logic/` layer from `catalog_sync.py`

**Agent**: modularity-reviewer

`handle_product_created`, `handle_product_updated` etc. contain the full pipeline inline. The activity-service extracts this to a `logic/` layer. A `CatalogSyncService` class accepting adapters as constructor parameters would make the business logic independently testable.

---

### 21. Merge `handle_product_created` and `handle_product_updated`

**Agent**: modularity-reviewer
**File**: `handlers/catalog_sync.py` lines 155-238

The two functions are character-for-character identical. A shared `_index_product(product_id, event_type, event_id, trace_parent)` helper eliminates the duplication.

---

### 22. Move `ProductApiClient` from `adapters/` to `clients/`

**Agent**: modularity-reviewer

`adapters/` communicates "AWS infrastructure adapters." `ProductApiClient` is an upstream service HTTP client — a fundamentally different concern with different change drivers and failure modes. `clients/product_api_client.py` is clearer.

---

### 23. Move DynamoDB serialisation out of `ProductMetadata`

**Agent**: coupling-analyzer, modularity-reviewer
**File**: `models/product.py` lines 42-84

`to_dynamo_item()` and `from_dynamo_item()` are DynamoDB persistence concerns sitting in the domain model. They encode DynamoDB attribute naming (`productId`, `stockLevel`) and the float-as-string serialisation hack. Move them to `MetadataRepository` which already owns the table reference.

---

### 24. Add custom metrics for LLM observability completeness

**Agent**: otel-tracing-reviewer

| Metric | Why |
|--------|-----|
| `product_search.embedding_duration_ms` | Detect Bedrock Titan latency regressions |
| `product_search.generation_duration_ms` | Detect Claude latency regressions |
| `product_search.products_found` (distribution) | Alert on sustained zero-result queries |
| `product_search.catalog_sync.cache_miss` | Track pricing/stock events arriving before product |

---

## Findings Summary

| # | Finding | Severity | Agent |
|---|---------|----------|-------|
| 1 | LLMObs spans orphaned from APM trace | 🔴 Critical | OTel |
| 2 | Bedrock throttle has no retry | 🔴 Critical | Architecture, FMEA |
| 3 | No DLQ alarm | 🔴 Critical | FMEA |
| 4 | `batch_get` infinite loop | 🔴 Critical | Architecture, FMEA |
| 5 | `ProductApiClient` swallows all exceptions | 🔴 Critical | Architecture, FMEA |
| 6 | SSM call has no timeout | 🔴 Critical | Architecture, FMEA |
| 7 | LLMObs decorator model names hardcoded | 🟡 Important | OTel, Evolvability |
| 8 | Errors never recorded on spans | 🟡 Important | OTel |
| 9 | `_run_rag_pipeline` has no span | 🟡 Important | OTel |
| 10 | Vector + DynamoDB repositories have no spans | 🟡 Important | OTel |
| 11 | DynamoDB + S3 Vectors silent write divergence | 🟡 Important | FMEA |
| 12 | pricing/stock race silently drops events | 🟡 Important | FMEA |
| 13 | Duplicate singleton factories in handlers | 🟡 Important | Coupling, Modularity |
| 14 | CDK IAM ARNs independent of env-vars | 🟡 Important | Evolvability |
| 15 | `messaging.system` tag wrong value | 🟡 Important | OTel |
| 16 | 1-day log retention too short | 🟡 Important | Architecture, FMEA |
| 17 | `batch_get` results not sorted by relevance | 🟢 Suggestion | Evolvability |
| 18 | Missing `is_remote=True` on span links | 🟢 Suggestion | OTel |
| 19 | No Protocol/ABC interfaces for adapters | 🟢 Suggestion | Coupling, Modularity, Evolvability |
| 20 | Missing `logic/` layer | 🟢 Suggestion | Modularity |
| 21 | `handle_product_created` / `handle_product_updated` identical | 🟢 Suggestion | Modularity |
| 22 | `ProductApiClient` in wrong package | 🟢 Suggestion | Modularity |
| 23 | DynamoDB serialisation in domain model | 🟢 Suggestion | Coupling, Modularity |
| 24 | Missing custom metrics | 🟢 Suggestion | OTel |

---

## What Is Done Well

- **Dependency direction**: clean DAG, no cycles. Handlers → adapters → models, never reversed.
- **SQS partial batch failure**: `process_partial_response` + `report_batch_item_failures=True` correctly implemented — failed records retry without poisoning the batch.
- **DSM checkpoints**: `set_consume_checkpoint` called before processing with correct carrier extraction from `_datadog` envelope.
- **Span links**: traceparent extraction, hex parsing, and `span.link_span()` correctly implemented — matches the activity-service reference exactly.
- **`DD_TRACE_PROPAGATION_STYLE_EXTRACT: none`**: correctly set on both functions — prevents auto-propagation interference.
- **Vector store encapsulation**: `VectorRepository` is a clean 3-method interface; S3 Vectors preview API is fully hidden behind it.
- **Registry dispatch pattern**: `_get_event_handler_registry()` makes new event types trivially addable — one constant, one function, one dict entry.
- **Input validation**: `/search` validates query is non-empty and ≤ 500 chars before any Bedrock call.
- **`batch_get` UnprocessedKeys retry**: correctly implemented (just needs a cap and backoff).
- **`observability/messaging.py` extraction**: better than the activity-service which buries these helpers in the handler file — independently testable here.
- **Evolvability score for vector store swap**: Easy — only `vector_repository.py` and the CDK IAM block change.
- **IAM scoping for SSM**: product API endpoint parameter is scoped to the exact ARN, not a wildcard prefix.

---

## Next Steps

1. Run `/triage` to process these 24 findings.
2. The 6 critical issues (particularly #1 — orphaned LLMObs spans) should be fixed before demoing the service to demonstrate the intended Datadog observability signals.
3. Consider `/workflows:evolve` to capture the LLMObs observability patterns (correct decorator usage, `@workflow` wrapping, span tags on RAG pipeline) as a compound doc for the repo.
