#!/bin/bash

set -e

cd "$(dirname "$0")"/..

BUCKET="david-cloudformation-template-test"

function aws-login() {
    cfg=( "$@" )
    shift
    aws-vault exec sandbox-account-admin --  ${cfg[@]}
}

echo "Inject code inline into cloudformation template"
rm -rf dist
mkdir dist

awk -v STRING_TO_REPLACE="INJECT_ENTRY_FUNCTION_CODE" -f scripts/inject_inline_code.awk handler.py template.yaml > dist/template.yaml
awk -v STRING_TO_REPLACE="INJECT_SQS_CONSUMER_CODE" -f scripts/inject_inline_code.awk handler.js dist/template.yaml > tmp && mv tmp dist/template.yaml

echo "Validating template.yaml"
aws-login aws cloudformation validate-template --template-body file://dist/template.yaml

echo "Uploading template and code zips to s3"
aws-login aws s3 cp dist/template.yaml s3://${BUCKET}/aws/sample-app-staging/latest.yaml