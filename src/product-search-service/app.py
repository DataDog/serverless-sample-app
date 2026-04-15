#!/usr/bin/env python3
import os

from aws_cdk import App, Environment
from boto3 import client, session

from cdk.product_search_service.product_search_stack import ProductSearchStack
from cdk.product_search_service.utils import get_stack_name

account = client('sts').get_caller_identity()['Account']
region = session.Session().region_name
environment = os.getenv('ENV', 'dev')
app = App()
my_stack = ProductSearchStack(
    scope=app,
    id=get_stack_name(),
    env=Environment(
        account=os.environ.get('CDK_DEFAULT_ACCOUNT', os.environ.get('AWS_ACCOUNT_ID', account)),
        region=os.environ.get('CDK_DEFAULT_REGION', os.environ.get('AWS_REGION', region))
    ),
)

app.synth()
