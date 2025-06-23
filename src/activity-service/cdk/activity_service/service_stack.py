import os

from aws_cdk import Aspects, Stack, Tags
from cdk_nag import AwsSolutionsChecks, NagSuppressions
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
            python_layer_version=109,
            extension_layer_version=81,
            service=SERVICE_NAME,
            env=environment,
            version=version,
            capture_lambda_payload=True,
            site=dd_site,
            api_key=dd_api_key,
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
        Aspects.of(self).add(AwsSolutionsChecks(verbose=True))
        # Suppress a specific rule for this resource
        NagSuppressions.add_stack_suppressions(
            self,
            [
                {'id': 'AwsSolutions-IAM4', 'reason': 'policy for cloudwatch logs.'},
                {'id': 'AwsSolutions-IAM5', 'reason': 'policy for cloudwatch logs.'},
                {'id': 'AwsSolutions-APIG2', 'reason': 'lambda does input validation'},
                {'id': 'AwsSolutions-APIG1', 'reason': 'not mandatory in a sample blueprint'},
                {'id': 'AwsSolutions-APIG3', 'reason': 'not mandatory in a sample blueprint'},
                {'id': 'AwsSolutions-APIG6', 'reason': 'not mandatory in a sample blueprint'},
                {'id': 'AwsSolutions-APIG4', 'reason': 'authorization not mandatory in a sample blueprint'},
                {'id': 'AwsSolutions-COG4', 'reason': 'not using cognito'},
                {'id': 'AwsSolutions-L1', 'reason': 'False positive'},
                {'id': 'AwsSolutions-SQS4', 'reason': 'DLQ configured correctly via CDK'},
            ],
        )
