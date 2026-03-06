import os

import aws_cdk as cdk
from aws_cdk import Duration, Stack, Tags
from aws_cdk import aws_apigatewayv2 as apigwv2
from aws_cdk import aws_apigatewayv2_integrations as apigwv2_integrations
from aws_cdk import aws_dynamodb as dynamodb
from aws_cdk import aws_events as events
from aws_cdk import aws_iam as iam
from aws_cdk import aws_lambda as _lambda
from aws_cdk import aws_ssm as ssm
from aws_cdk import custom_resources as cr
from aws_cdk.aws_events_targets import SqsQueue
from aws_cdk.aws_lambda_event_sources import SqsEventSource
from aws_cdk.aws_logs import RetentionDays
from aws_cdk.aws_sqs import DeadLetterQueue, Queue
from constructs import Construct
from datadog_cdk_constructs_v2 import DatadogLambda

SERVICE_NAME = "product-search-service"
LAMBDA_TIMEOUT_SECONDS = 29
LAMBDA_MEMORY_MB = 512
BUILD_FOLDER = "../.build/lambdas/"


class ProductSearchStack(Stack):
    def __init__(self, scope: Construct, id: str, **kwargs) -> None:
        super().__init__(scope, id, **kwargs)

        environment = os.environ.get("ENV", "dev")
        version = os.environ.get("VERSION", "latest")
        dd_api_key = os.environ.get("DD_API_KEY", "")
        dd_site = os.environ.get("DD_SITE", "datadoghq.com")
        embedding_model_id = os.environ.get("EMBEDDING_MODEL_ID", "amazon.titan-embed-text-v2:0")
        generation_model_id = os.environ.get("GENERATION_MODEL_ID", "anthropic.claude-3-5-haiku-20241022-v1:0")

        Tags.of(self).add("service", SERVICE_NAME)

        # ---------------------------------------------------------------------------
        # Datadog Lambda instrumentation
        # ---------------------------------------------------------------------------
        datadog = DatadogLambda(
            self,
            "DatadogLambda",
            python_layer_version=123,
            extension_layer_version=93,
            service=SERVICE_NAME,
            env=environment,
            version=version,
            capture_lambda_payload=True,
            site=dd_site,
            api_key=dd_api_key,
            enable_cold_start_tracing=True,
            enable_datadog_tracing=True,
        )

        # ---------------------------------------------------------------------------
        # DynamoDB — product metadata
        # ---------------------------------------------------------------------------
        metadata_table = dynamodb.Table(
            self,
            "ProductMetadataTable",
            table_name=f"ProductMetadataTable-{environment}",
            partition_key=dynamodb.Attribute(name="productId", type=dynamodb.AttributeType.STRING),
            billing_mode=dynamodb.BillingMode.PAY_PER_REQUEST,
            removal_policy=cdk.RemovalPolicy.DESTROY,
        )

        # ---------------------------------------------------------------------------
        # S3 Vectors — vector bucket + index (no native CloudFormation support yet;
        # AwsCustomResource calls the s3vectors SDK directly during deploy/destroy).
        #
        # A single shared role is created explicitly so all required s3vectors
        # permissions are guaranteed to be present before either custom resource runs.
        # ---------------------------------------------------------------------------
        vector_bucket_name = f"serverless-sample-app-vector-{environment}"
        vector_index_name = "products"

        vector_cr_role = iam.Role(
            self,
            "VectorCustomResourceRole",
            assumed_by=iam.ServicePrincipal("lambda.amazonaws.com"),
            managed_policies=[
                iam.ManagedPolicy.from_aws_managed_policy_name("service-role/AWSLambdaBasicExecutionRole"),
            ],
            inline_policies={
                "s3vectors": iam.PolicyDocument(
                    statements=[
                        iam.PolicyStatement(
                            actions=[
                                "s3vectors:CreateVectorBucket",
                                "s3vectors:DeleteVectorBucket",
                                "s3vectors:CreateIndex",
                                "s3vectors:DeleteIndex",
                            ],
                            resources=["*"],
                            effect=iam.Effect.ALLOW,
                        )
                    ]
                )
            },
        )

        vector_bucket_cr = cr.AwsCustomResource(
            self,
            "VectorBucket",
            role=vector_cr_role,
            install_latest_aws_sdk=True,
            on_create=cr.AwsSdkCall(
                service="S3Vectors",
                action="createVectorBucket",
                parameters={"vectorBucketName": vector_bucket_name},
                physical_resource_id=cr.PhysicalResourceId.of(vector_bucket_name),
                ignore_error_codes_matching=".*AlreadyExists.*",
            ),
            on_delete=cr.AwsSdkCall(
                service="S3Vectors",
                action="deleteVectorBucket",
                parameters={"vectorBucketName": vector_bucket_name},
                ignore_error_codes_matching=".*NotFound.*|.*NoSuchBucket.*",
            ),
            policy=cr.AwsCustomResourcePolicy.from_sdk_calls(resources=cr.AwsCustomResourcePolicy.ANY_RESOURCE),
        )

        vector_index_cr = cr.AwsCustomResource(
            self,
            "VectorIndex",
            role=vector_cr_role,
            install_latest_aws_sdk=True,
            on_create=cr.AwsSdkCall(
                service="S3Vectors",
                action="createIndex",
                parameters={
                    "vectorBucketName": vector_bucket_name,
                    "indexName": vector_index_name,
                    "dataType": "float32",
                    "dimension": 1024,
                    "distanceMetric": "cosine",
                },
                physical_resource_id=cr.PhysicalResourceId.of(f"{vector_bucket_name}/{vector_index_name}"),
                ignore_error_codes_matching=".*AlreadyExists.*",
            ),
            on_delete=cr.AwsSdkCall(
                service="S3Vectors",
                action="deleteIndex",
                parameters={
                    "vectorBucketName": vector_bucket_name,
                    "indexName": vector_index_name,
                },
                ignore_error_codes_matching=".*NotFound.*|.*NoSuchIndex.*",
            ),
            policy=cr.AwsCustomResourcePolicy.from_sdk_calls(resources=cr.AwsCustomResourcePolicy.ANY_RESOURCE),
        )
        # Index must be created after the bucket
        vector_index_cr.node.add_dependency(vector_bucket_cr)

        # ---------------------------------------------------------------------------
        # SQS — catalog sync queue + DLQ
        # ---------------------------------------------------------------------------
        catalog_sync_dlq = Queue(
            self,
            "CatalogSyncDLQ",
            queue_name=f"{SERVICE_NAME}-catalog-sync-dlq-{environment}",
            retention_period=Duration.days(14),
        )

        catalog_sync_queue = Queue(
            self,
            "CatalogSyncQueue",
            queue_name=f"{SERVICE_NAME}-catalog-sync-queue-{environment}",
            visibility_timeout=Duration.seconds(LAMBDA_TIMEOUT_SECONDS * 6),
            dead_letter_queue=DeadLetterQueue(
                max_receive_count=3,
                queue=catalog_sync_dlq,
            ),
        )

        # ---------------------------------------------------------------------------
        # EventBridge — read shared bus from SSM, subscribe to relevant events
        # ---------------------------------------------------------------------------
        shared_event_bus_name_param = ssm.StringParameter.from_string_parameter_name(
            self,
            "SharedEventBusNameParameter",
            f"/{environment}/shared/event-bus-name",
        )

        shared_event_bus = events.EventBus.from_event_bus_name(
            self,
            "SharedEventBus",
            shared_event_bus_name_param.string_value,
        )

        subscribed_events = [
            ("product.productCreated.v1", f"{environment}.products"),
            ("product.productUpdated.v1", f"{environment}.products"),
            ("product.productDeleted.v1", f"{environment}.products"),
            ("pricing.pricingCalculated.v1", f"{environment}.pricing"),
            ("inventory.stockUpdated.v1", f"{environment}.inventory"),
        ]

        for detail_type, source in subscribed_events:
            rule_id = detail_type.replace(".", "_")
            rule = events.Rule(
                self,
                f"CatalogSync_{rule_id}",
                rule_name=f"{SERVICE_NAME}-{rule_id}-{environment}",
                description=f"{SERVICE_NAME} subscribing to {detail_type} in the '{environment}' environment",
                event_bus=shared_event_bus,
                event_pattern=events.EventPattern(
                    detail_type=[detail_type],
                    source=[source],
                ),
            )
            rule.add_target(SqsQueue(catalog_sync_queue))

        # ---------------------------------------------------------------------------
        # IAM roles
        # ---------------------------------------------------------------------------
        catalog_sync_role = iam.Role(
            self,
            "CatalogSyncFunctionRole",
            role_name=f"CDK-{SERVICE_NAME}-catalog-sync-{environment}",
            assumed_by=iam.ServicePrincipal("lambda.amazonaws.com"),
            managed_policies=[
                iam.ManagedPolicy.from_aws_managed_policy_name("service-role/AWSLambdaBasicExecutionRole"),
            ],
            inline_policies={
                "bedrock_embed": iam.PolicyDocument(
                    statements=[
                        iam.PolicyStatement(
                            actions=["bedrock:InvokeModel"],
                            resources=[
                                f"arn:aws:bedrock:{self.region}::foundation-model/{embedding_model_id}"
                            ],
                            effect=iam.Effect.ALLOW,
                        )
                    ]
                ),
                "dynamodb_write": iam.PolicyDocument(
                    statements=[
                        iam.PolicyStatement(
                            actions=[
                                "dynamodb:PutItem",
                                "dynamodb:UpdateItem",
                                "dynamodb:DeleteItem",
                                "dynamodb:GetItem",
                            ],
                            resources=[metadata_table.table_arn],
                            effect=iam.Effect.ALLOW,
                        )
                    ]
                ),
                "ssm_product_api": iam.PolicyDocument(
                    statements=[
                        iam.PolicyStatement(
                            actions=["ssm:GetParameter"],
                            resources=[
                                f"arn:aws:ssm:{self.region}:{self.account}:parameter/{environment}/ProductService/api-endpoint"
                            ],
                            effect=iam.Effect.ALLOW,
                        )
                    ]
                ),
                # TODO: Replace wildcard resource with exact S3 Vectors ARN once the ARN format
                # is published and the service exits preview.
                "s3_vectors_write": iam.PolicyDocument(
                    statements=[
                        iam.PolicyStatement(
                            actions=[
                                "s3vectors:PutVectors",
                                "s3vectors:GetVectors",
                                "s3vectors:DeleteVectors",
                                "s3vectors:ListVectors",
                            ],
                            resources=["*"],
                            effect=iam.Effect.ALLOW,
                        )
                    ]
                ),
            },
        )

        product_search_role = iam.Role(
            self,
            "ProductSearchFunctionRole",
            role_name=f"CDK-{SERVICE_NAME}-product-search-{environment}",
            assumed_by=iam.ServicePrincipal("lambda.amazonaws.com"),
            managed_policies=[
                iam.ManagedPolicy.from_aws_managed_policy_name("service-role/AWSLambdaBasicExecutionRole"),
            ],
            inline_policies={
                "bedrock_invoke": iam.PolicyDocument(
                    statements=[
                        iam.PolicyStatement(
                            actions=["bedrock:InvokeModel"],
                            resources=[
                                f"arn:aws:bedrock:{self.region}::foundation-model/{embedding_model_id}",
                                f"arn:aws:bedrock:{self.region}::foundation-model/{generation_model_id}",
                            ],
                            effect=iam.Effect.ALLOW,
                        )
                    ]
                ),
                "dynamodb_read": iam.PolicyDocument(
                    statements=[
                        iam.PolicyStatement(
                            actions=["dynamodb:BatchGetItem"],
                            resources=[metadata_table.table_arn],
                            effect=iam.Effect.ALLOW,
                        )
                    ]
                ),
                # TODO: Replace wildcard resource with exact S3 Vectors ARN once the ARN format
                # is published and the service exits preview.
                "s3_vectors_query": iam.PolicyDocument(
                    statements=[
                        iam.PolicyStatement(
                            actions=[
                                "s3vectors:QueryVectors",
                                "s3vectors:GetVectors",
                                "s3vectors:ListVectors",
                            ],
                            resources=["*"],
                            effect=iam.Effect.ALLOW,
                        )
                    ]
                ),
            },
        )

        # ---------------------------------------------------------------------------
        # Lambda functions
        # ---------------------------------------------------------------------------
        catalog_sync_fn = _lambda.Function(
            self,
            "CatalogSyncFunction",
            function_name=f"{SERVICE_NAME}-catalog-sync-{environment}",
            runtime=_lambda.Runtime.PYTHON_3_13,
            architecture=_lambda.Architecture.ARM_64,
            # The build process (via `make build`) pip-installs dependencies and copies
            # the product_search_service package into .build/lambdas/ for Lambda packaging.
            code=_lambda.Code.from_asset(BUILD_FOLDER),
            handler="product_search_service.handlers.catalog_sync.lambda_handler",
            environment={
                "POWERTOOLS_SERVICE_NAME": SERVICE_NAME,
                "POWERTOOLS_LOG_LEVEL": "INFO",
                "DD_TRACE_PROPAGATION_BEHAVIOR_EXTRACT": "ignore",
                "DD_TRACE_PROPAGATION_STYLE_EXTRACT": "none",
                "DD_BOTOCORE_DISTRIBUTED_TRACING": "false",
                "DD_DATA_STREAMS_ENABLED": "true",
                "DD_LLMOBS_ENABLED": "1",
                "DD_LLMOBS_ML_APP": SERVICE_NAME,
                "VECTOR_BUCKET_NAME": f"serverless-sample-app-vector-{environment}",
                "VECTOR_INDEX_NAME": "products",
                "METADATA_TABLE_NAME": metadata_table.table_name,
                "PRODUCT_API_ENDPOINT_PARAMETER": f"/{environment}/ProductService/api-endpoint",
                "EMBEDDING_MODEL_ID": embedding_model_id,
                "ENV": environment,
            },
            tracing=_lambda.Tracing.ACTIVE,
            retry_attempts=0,
            timeout=Duration.seconds(LAMBDA_TIMEOUT_SECONDS),
            memory_size=LAMBDA_MEMORY_MB,
            role=catalog_sync_role,
            log_retention=RetentionDays.ONE_WEEK,
            logging_format=_lambda.LoggingFormat.JSON,
            system_log_level_v2=_lambda.SystemLogLevel.INFO,
        )

        catalog_sync_fn.add_event_source(
            SqsEventSource(
                queue=catalog_sync_queue,
                batch_size=10,
                report_batch_item_failures=True,
            )
        )

        product_search_fn = _lambda.Function(
            self,
            "ProductSearchFunction",
            function_name=f"{SERVICE_NAME}-product-search-{environment}",
            runtime=_lambda.Runtime.PYTHON_3_13,
            architecture=_lambda.Architecture.ARM_64,
            # The build process (via `make build`) pip-installs dependencies and copies
            # the product_search_service package into .build/lambdas/ for Lambda packaging.
            code=_lambda.Code.from_asset(BUILD_FOLDER),
            handler="product_search_service.handlers.product_search.lambda_handler",
            environment={
                "POWERTOOLS_SERVICE_NAME": SERVICE_NAME,
                "POWERTOOLS_LOG_LEVEL": "INFO",
                "DD_LLMOBS_ENABLED": "1",
                "DD_LLMOBS_ML_APP": SERVICE_NAME,
                "DD_TRACE_PROPAGATION_BEHAVIOR_EXTRACT": "ignore",
                "DD_TRACE_PROPAGATION_STYLE_EXTRACT": "none",
                "DD_BOTOCORE_DISTRIBUTED_TRACING": "false",
                "DD_DATA_STREAMS_ENABLED": "true",
                "VECTOR_BUCKET_NAME": f"serverless-sample-app-vector-{environment}",
                "VECTOR_INDEX_NAME": "products",
                "METADATA_TABLE_NAME": metadata_table.table_name,
                "EMBEDDING_MODEL_ID": embedding_model_id,
                "GENERATION_MODEL_ID": generation_model_id,
                "SEARCH_TOP_K": "5",
                "ENV": environment,
            },
            tracing=_lambda.Tracing.ACTIVE,
            retry_attempts=0,
            timeout=Duration.seconds(LAMBDA_TIMEOUT_SECONDS),
            memory_size=LAMBDA_MEMORY_MB,
            role=product_search_role,
            log_retention=RetentionDays.ONE_WEEK,
            logging_format=_lambda.LoggingFormat.JSON,
            system_log_level_v2=_lambda.SystemLogLevel.INFO,
        )

        # ---------------------------------------------------------------------------
        # HTTP API Gateway — POST /search
        # ---------------------------------------------------------------------------
        http_api = apigwv2.HttpApi(
            self,
            "ProductSearchApi",
            api_name=f"Product Search API - {environment}",
            description="HTTP API for AI-powered product search",
            cors_preflight=apigwv2.CorsPreflightOptions(
                allow_origins=["*"],
                allow_methods=[apigwv2.CorsHttpMethod.ANY],
                allow_headers=["Content-Type", "Authorization"],
            ),
        )

        http_api.add_routes(
            path="/search",
            methods=[apigwv2.HttpMethod.POST],
            integration=apigwv2_integrations.HttpLambdaIntegration(
                "ProductSearchIntegration",
                product_search_fn,
            ),
        )

        # ---------------------------------------------------------------------------
        # SSM Parameter — expose API endpoint for downstream consumers
        # ---------------------------------------------------------------------------
        ssm.StringParameter(
            self,
            "ProductSearchApiEndpointParameter",
            parameter_name=f"/{environment}/ProductSearchService/api-endpoint",
            string_value=http_api.url or "",
        )

        # ---------------------------------------------------------------------------
        # Wire up Datadog instrumentation
        # ---------------------------------------------------------------------------
        datadog.add_lambda_functions([catalog_sync_fn, product_search_fn])

        # ---------------------------------------------------------------------------
        # Stack outputs
        # ---------------------------------------------------------------------------
        cdk.CfnOutput(self, "ApiEndpoint", value=http_api.url or "")
        cdk.CfnOutput(self, "MetadataTableName", value=metadata_table.table_name)
        cdk.CfnOutput(self, "VectorBucketName", value=vector_bucket_name)
        cdk.CfnOutput(self, "VectorIndexName", value=vector_index_name)
