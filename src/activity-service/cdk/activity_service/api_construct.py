from aws_cdk import CfnOutput, Duration, RemovalPolicy, aws_apigateway
from aws_cdk import aws_dynamodb as dynamodb
from aws_cdk import aws_iam as iam
from aws_cdk import aws_lambda as _lambda
from aws_cdk.aws_events_targets import SqsQueue
from aws_cdk.aws_lambda_event_sources import SqsEventSource
from aws_cdk.aws_lambda_python_alpha import PythonLayerVersion
from aws_cdk.aws_logs import RetentionDays
from aws_cdk.aws_sqs import DeadLetterQueue, Queue
from aws_cdk.aws_ssm import StringParameter
from constructs import Construct

import cdk.activity_service.constants as constants
from cdk.activity_service.api_db_construct import ApiDbConstruct
from cdk.activity_service.constants import SERVICE_NAME
from cdk.activity_service.shared_props import SharedProps
from cdk.activity_service.shared_resources_construct import SharedResources
from cdk.activity_service.waf_construct import WafToApiGatewayConstruct


class ApiConstruct(Construct):
    def __init__(self, scope: Construct, shared_props: SharedProps, id_: str, is_production_env: bool) -> None:
        super().__init__(scope, id_)

        self.shared_resources = SharedResources(scope, shared_props)
        self.id_ = id_
        self.api_db = ApiDbConstruct(self, f'{id_}db-{shared_props.environment}')
        self.lambda_role = self._build_lambda_role(self.api_db.db, self.api_db.idempotency_db)
        self.common_layer = self._build_common_layer()
        self.rest_api = self._build_api_gw()
        api_resource: aws_apigateway.Resource = self.rest_api.root.add_resource('api')
        activity_resource = api_resource.add_resource(constants.GW_RESOURCE)
        entity_type_resource = activity_resource.add_resource("{entity_type}")
        entity_id_resource = entity_type_resource.add_resource("{entity_id}")
        self.create_order_func = self._add_get_activity_integration(
            entity_id_resource, self.lambda_role, self.api_db.db, self.api_db.idempotency_db
        )

        if is_production_env:
            # add WAF
            self.waf = WafToApiGatewayConstruct(self, f'{id_}waf', self.rest_api)

        self.activity_dlq = Queue(
            self,
            f'{SERVICE_NAME}-activity-dlq-{self.shared_resources.shared_props.environment}',
            retention_period=Duration.days(14),  # Keep failed messages for 14 days for investigation
        )

        # Create the main queue with DLQ configuration
        self.activity_queue = Queue(
            self,
            f'{SERVICE_NAME}-activity-queue-{self.shared_resources.shared_props.environment}',
            dead_letter_queue=DeadLetterQueue(
                max_receive_count=3,  # After 3 failed processing attempts, send to DLQ
                queue=self.activity_dlq
            ),
            visibility_timeout=Duration.seconds(constants.API_HANDLER_LAMBDA_TIMEOUT * 6),
            # Set visibility timeout to 6x the Lambda timeout
        )

        subscribed_event_list = [
            "product.productCreated.v1",
            "product.productUpdated.v1",
            "product.productDeleted.v1",
            "users.userCreated.v1",
            "orders.orderCreated.v1",
            "orders.orderConfirmed.v1",
            "orders.orderCompleted.v1",
            "inventory.stockUpdated.v1",
            "inventory.stockReserved.v1",
            "inventory.stockReservationFailed.v1",
        ]

        # Create the event bus and add the rules for the events we want to subscribe to
        for event in subscribed_event_list:
            subscription_rule = self.shared_resources.add_subscription_rule(self, f"activity_{event.replace(".", "_")}", event)
            subscription_rule.add_target(SqsQueue(self.activity_queue))

        self.event_handler_func = self._build_handle_events_function(self.lambda_role, self.api_db.db, self.api_db.idempotency_db)
        # Add the SQS event source to the Lambda function
        self.event_handler_func.add_event_source(
            SqsEventSource(
                queue=self.activity_queue,
                batch_size=10,  # Number of messages to process in a single Lambda invocation
                report_batch_item_failures=True  # Enable partial batch processing
            )
        )

        shared_props.datadog_configuration.add_lambda_functions([self.event_handler_func, self.create_order_func])

    def _build_api_gw(self) -> aws_apigateway.RestApi:
        rest_api: aws_apigateway.RestApi = aws_apigateway.RestApi(
            self,
            'service-rest-api',
            rest_api_name=f'Activity Service Rest API - {self.shared_resources.shared_props.environment}',
            description='This service handles /api/activity requests',
            deploy_options=aws_apigateway.StageOptions(throttling_rate_limit=2, throttling_burst_limit=10),
            cloud_watch_role=False,
        )

        StringParameter(
            self,
            "ActivityApiEndpointParameter",
            parameter_name=f"/{self.shared_resources.shared_props.environment}/{self.shared_resources.shared_props.service_name}/api-endpoint",
            string_value=rest_api.url,
        )

        CfnOutput(self, id=constants.APIGATEWAY, value=rest_api.url).override_logical_id(constants.APIGATEWAY)
        return rest_api

    def _build_lambda_role(self, db: dynamodb.TableV2, idempotency_table: dynamodb.TableV2) -> iam.Role:
        return iam.Role(
            self,
            constants.SERVICE_ROLE_ARN,
            role_name=f"{constants.SERVICE_NAME}-{constants.SERVICE_ROLE}-{self.shared_resources.shared_props.environment}",
            assumed_by=iam.ServicePrincipal('lambda.amazonaws.com'),
            inline_policies={
                'dynamic_configuration': iam.PolicyDocument(
                    statements=[
                        iam.PolicyStatement(
                            actions=['appconfig:GetLatestConfiguration', 'appconfig:StartConfigurationSession'],
                            resources=['*'],
                            effect=iam.Effect.ALLOW,
                        )
                    ]
                ),
                'dynamodb_db': iam.PolicyDocument(
                    statements=[
                        iam.PolicyStatement(
                            actions=['dynamodb:PutItem', 'dynamodb:GetItem', 'dynamodb:Query'],
                            resources=[db.table_arn],
                            effect=iam.Effect.ALLOW,
                        )
                    ]
                ),
                'idempotency_table': iam.PolicyDocument(
                    statements=[
                        iam.PolicyStatement(
                            actions=['dynamodb:PutItem', 'dynamodb:GetItem', 'dynamodb:UpdateItem', 'dynamodb:DeleteItem'],
                            resources=[idempotency_table.table_arn],
                            effect=iam.Effect.ALLOW,
                        )
                    ]
                ),
            },
            managed_policies=[
                iam.ManagedPolicy.from_aws_managed_policy_name(managed_policy_name=(f'service-role/{constants.LAMBDA_BASIC_EXECUTION_ROLE}'))
            ],
        )

    def _build_common_layer(self) -> PythonLayerVersion:
        return PythonLayerVersion(
            self,
            f'{self.id_}{constants.LAMBDA_LAYER_NAME}-{self.shared_resources.shared_props.environment}',
            entry=constants.COMMON_LAYER_BUILD_FOLDER,
            compatible_runtimes=[_lambda.Runtime.PYTHON_3_13],
            removal_policy=RemovalPolicy.DESTROY,
        )

    def _add_get_activity_integration(
        self,
        api_resource: aws_apigateway.Resource,
        role: iam.Role,
        db: dynamodb.TableV2,
        idempotency_table: dynamodb.TableV2,
    ) -> _lambda.Function:
        lambda_function = _lambda.Function(
            self,
            constants.GET_ACTIVITY_LAMBDA,
            function_name=f"{constants.SERVICE_NAME}-{constants.GET_ACTIVITY_LAMBDA}-{self.shared_resources.shared_props.environment}",
            runtime=_lambda.Runtime.PYTHON_3_13,
            code=_lambda.Code.from_asset(constants.BUILD_FOLDER),
            handler='activity_service.handlers.handle_get_activity.lambda_handler',
            environment={
                constants.POWERTOOLS_SERVICE_NAME: constants.SERVICE_NAME,  # for logger, tracer and metrics
                constants.POWER_TOOLS_LOG_LEVEL: 'INFO',  # for logger
                'TABLE_NAME': db.table_name,
                'IDEMPOTENCY_TABLE_NAME': idempotency_table.table_name,
            },
            tracing=_lambda.Tracing.ACTIVE,
            retry_attempts=0,
            timeout=Duration.seconds(constants.API_HANDLER_LAMBDA_TIMEOUT),
            memory_size=constants.API_HANDLER_LAMBDA_MEMORY_SIZE,
            layers=[self.common_layer],
            role=role,
            log_retention=RetentionDays.ONE_DAY,
            logging_format=_lambda.LoggingFormat.JSON,
            system_log_level_v2=_lambda.SystemLogLevel.INFO,
        )

        # GET /api/activities/
        api_resource.add_method(http_method='GET', integration=aws_apigateway.LambdaIntegration(handler=lambda_function))
        return lambda_function

    def _build_handle_events_function(
        self,
        role: iam.Role,
        db: dynamodb.TableV2,
        idempotency_table: dynamodb.TableV2,
    ) -> _lambda.Function:
        lambda_function = _lambda.Function(
            self,
            constants.HANDLE_EVENTS_LAMBDA,
            function_name=f"{constants.SERVICE_NAME}-{constants.HANDLE_EVENTS_LAMBDA}-{self.shared_resources.shared_props.environment}",
            runtime=_lambda.Runtime.PYTHON_3_13,
            code=_lambda.Code.from_asset(constants.BUILD_FOLDER),
            handler='activity_service.handlers.create_activity.lambda_handler',
            environment={
                constants.POWERTOOLS_SERVICE_NAME: constants.SERVICE_NAME,  # for logger, tracer and metrics
                constants.POWER_TOOLS_LOG_LEVEL: 'INFO',  # for logger
                'TABLE_NAME': db.table_name,
                'IDEMPOTENCY_TABLE_NAME': idempotency_table.table_name,
            },
            tracing=_lambda.Tracing.ACTIVE,
            retry_attempts=0,
            timeout=Duration.seconds(constants.API_HANDLER_LAMBDA_TIMEOUT),
            memory_size=constants.API_HANDLER_LAMBDA_MEMORY_SIZE,
            layers=[self.common_layer],
            role=role,
            log_retention=RetentionDays.ONE_DAY,
            logging_format=_lambda.LoggingFormat.JSON,
            system_log_level_v2=_lambda.SystemLogLevel.INFO,
        )
        return lambda_function
