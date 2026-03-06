from __future__ import annotations

import boto3
from ddtrace import tracer


class VectorRepository:
    """Manages product embedding vectors in an S3 Vectors index.

    S3 Vectors uses a two-level hierarchy:
      - Vector Bucket  (VECTOR_BUCKET_NAME env var)
      - Vector Index   (VECTOR_INDEX_NAME env var, default "products")

    The vector bucket and index must be pre-created before deployment.
    Create them via the AWS CLI:
      aws s3vectors create-vector-bucket --vector-bucket-name <name>
      aws s3vectors create-index --vector-bucket-name <name> \\
          --index-name products --data-type float32 --dimension 1024 \\
          --distance-metric cosine
    """

    def __init__(self, bucket_name: str, index_name: str = "products") -> None:
        self._bucket_name = bucket_name
        self._index_name = index_name
        self._client = boto3.client("s3vectors")  # type: ignore[attr-defined]

    @tracer.wrap(resource="vector_repository.upsert")
    def upsert(
        self, product_id: str, embedding: list[float], metadata: dict[str, str]
    ) -> None:
        """Store or replace a product embedding in the vector index.

        Args:
            product_id: The unique product identifier used as the vector key.
            embedding: The float32 embedding vector to store.
            metadata: Arbitrary string key-value metadata to associate with the vector.
        """
        self._client.put_vectors(  # type: ignore[attr-defined]
            vectorBucketName=self._bucket_name,
            indexName=self._index_name,
            vectors=[
                {
                    "key": product_id,
                    "data": {"float32": embedding},
                    "metadata": metadata,
                }
            ],
        )

    @tracer.wrap(resource="vector_repository.query")
    def query(self, embedding: list[float], top_k: int = 5) -> list[tuple[str, float]]:
        """Find the top-K most similar products by vector similarity.

        Args:
            embedding: The query embedding vector.
            top_k: The maximum number of results to return.

        Returns:
            A list of ``(product_id, similarity_score)`` tuples ordered by similarity.
        """
        response = self._client.query_vectors(  # type: ignore[attr-defined]
            vectorBucketName=self._bucket_name,
            indexName=self._index_name,
            queryVector={"float32": embedding},
            topK=top_k,
            returnMetadata=False,
            returnDistance=True,
        )
        results: list[tuple[str, float]] = [
            (v["key"], v.get("distance", 0.0))
            for v in response.get("vectors", [])
        ]
        span = tracer.current_span()
        if span:
            span.set_tag("vector.top_k", top_k)
            span.set_tag("vector.matches_returned", len(results))
        return results

    @tracer.wrap(resource="vector_repository.delete")
    def delete(self, product_id: str) -> None:
        """Remove a product embedding from the vector index.

        Args:
            product_id: The unique product identifier of the vector to delete.
        """
        self._client.delete_vectors(  # type: ignore[attr-defined]
            vectorBucketName=self._bucket_name,
            indexName=self._index_name,
            keys=[product_id],
        )
