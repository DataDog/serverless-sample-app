import os

from aws_cdk import Acknowledgment, Stack, Tags, Validations
from cdk_nag import AwsSolutionsChecks
from constructs import Construct
from datadog_cdk_constructs_v2 import DatadogLambda

from cdk.activity_service.api_construct import ApiConstruct
from cdk.activity_service.constants import SERVICE_NAME, SERVICE_NAME_TAG
from cdk.activity_service.shared_props import SharedProps
from cdk.activity_service.utils import get_construct_name


class ServiceStack(Stack):
    def __init__(self, scope: Construct, id: str, is_production_env: bool, **kwargs) -> None:
        super().__init__(scope, id, **kwargs)
        self._add_stack_tags()

        environment = os.environ.get("ENV", "dev")
        version = os.environ.get("VERSION", "latest")
        dd_api_key = os.environ.get("DD_API_KEY", "")
        dd_site = os.environ.get("DD_SITE", "datadoghq.com")

        self.datadog_configuration = DatadogLambda(self, "DatadogLambda",
            python_layer_version=127,
            extension_layer_version=99,
            service=SERVICE_NAME,
            env=environment,
            version=version,
            capture_lambda_payload=True,
            site=dd_site,
            api_key=dd_api_key,
            enable_cold_start_tracing=True,
           # Disabled: datadog-cdk-constructs-v2 reads the internal
           # `environment` field of Function, which aws-cdk-lib no longer
           # exposes, so enabling this throws
           # "TypeError: Cannot read properties of undefined (reading 'value')"
           # during synth. Re-enable once the construct library is fixed.
           source_code_integration=False,
           enable_datadog_tracing=True,
        )

        self.shared_props = SharedProps("activity", "activity", SERVICE_NAME, environment, version, self.datadog_configuration)

        self.api = ApiConstruct(
            self,
            self.shared_props,
            get_construct_name(stack_prefix=id, construct_name='Crud'),
            is_production_env=is_production_env,
        )

        # add security check
        self._add_security_tests()



    def _add_stack_tags(self) -> None:
        # best practice to help identify resources in the console
        Tags.of(self).add(SERVICE_NAME_TAG, SERVICE_NAME)

    def _add_security_tests(self) -> None:
        # cdk-nag v3 rule packs are validation plugins rather than Aspects, and
        # must be registered at App/Stage scope.
        app = self.node.root
        Validations.of(app).add_plugins(AwsSolutionsChecks(app, verbose=True))
        # Acknowledge (suppress) specific rules for this stack.
        # cdk-nag v3 replaced NagSuppressions with CDK's native
        # Validations.of().acknowledge() API.
        for rule_id, reason in (
            ('AwsSolutions-IAM4', 'policy for cloudwatch logs.'),
            ('AwsSolutions-IAM5', 'policy for cloudwatch logs.'),
            ('AwsSolutions-APIG2', 'lambda does input validation'),
            ('AwsSolutions-APIG1', 'not mandatory in a sample blueprint'),
            ('AwsSolutions-APIG3', 'not mandatory in a sample blueprint'),
            ('AwsSolutions-APIG6', 'not mandatory in a sample blueprint'),
            ('AwsSolutions-APIG4', 'authorization not mandatory in a sample blueprint'),
            ('AwsSolutions-COG4', 'not using cognito'),
            ('AwsSolutions-L1', 'False positive'),
            ('AwsSolutions-SQS4', 'DLQ configured correctly via CDK'),
        ):
            Validations.of(self).acknowledge(Acknowledgment(id=rule_id, reason=reason))
