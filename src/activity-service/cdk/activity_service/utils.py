import os

import cdk.activity_service.constants as constants


def get_stack_name() -> str:
    cicd_environment = os.getenv('ENV', 'dev')
    return f'{constants.SERVICE_NAME}-{cicd_environment}'

def get_construct_name(stack_prefix: str, construct_name: str) -> str:
    return f'{stack_prefix}-{construct_name}'[0:64]
