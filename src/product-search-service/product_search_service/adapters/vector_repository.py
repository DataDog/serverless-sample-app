from __future__ import annotations

# NOTE: S3 Vectors boto3 API is in preview. Verify method signatures against current AWS documentation.

import boto3
from ddtrace import tracer
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from mypy_boto3_s3vectors import S3VectorsClient  # type: ignore[import]


class VectorRepository:
    """Manages product embedding vectors in the S3 Vector Object Store."""

    def __init__(self, bucket_name: str) -> None:
        self._bucket_name = bucket_name
        self._client = boto3.client("s3vectors")  # type: ignore[attr-defined]

    @tracer.wrap(resource="vector_repository.upsert")
    def upsert(
        self, product_id: str, embedding: list[float], metadata: dict[str, str]
    ) -> None:
        """Store or replace a product embedding in the vector bucket.

        Args:
            product_id: The unique product identifier used as the object key.
            embedding: The embedding vector to store.
            metadata: Arbitrary string key-value metadata to associate with the vector.
        """
        self._client.put_object(  # type: ignore[attr-defined]
            VectorBucketName=self._bucket_name,
            Key=product_id,
            Vector=embedding,
            Metadata=metadata,
        )

    @tracer.wrap(resource="vector_repository.query")
    def query(self, embedding: list[float], top_k: int = 5) -> list[tuple[str, float]]:
        """Find the top-K most similar products by vector similarity.

        Args:
            embedding: The query embedding vector.
            top_k: The maximum number of results to return.

        Returns:
            A list of ``(product_id, similarity_score)`` tuples, ordered by
            descending similarity.
        """
        response = self._client.query_objects(  # type: ignore[attr-defined]
            VectorBucketName=self._bucket_name,
            QueryVector=embedding,
            TopK=top_k,
            ReturnMetadata=False,
        )
        results: list[tuple[str, float]] = [
            (match["Key"], match.get("Score", 0.0))
            for match in response.get("Matches", [])
        ]
        span = tracer.current_span()
        if span:
            span.set_tag("vector.top_k", top_k)
            span.set_tag("vector.matches_returned", len(results))
        return results

    @tracer.wrap(resource="vector_repository.delete")
    def delete(self, product_id: str) -> None:
        """Remove a product embedding from the vector bucket.

        Args:
            product_id: The unique product identifier of the vector to delete.
        """
        self._client.delete_object(  # type: ignore[attr-defined]
            VectorBucketName=self._bucket_name,
            Key=product_id,
        )
