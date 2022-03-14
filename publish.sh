#!/bin/bash

set -e

BUCKET="datadog-cloudformation-template-sandbox"

function aws-login() {
    cfg=( "$@" )
    shift
    aws-vault exec sandbox-account-admin --  ${cfg[@]}
}

aws-login aws s3 cp template.yaml s3://${BUCKET}/aws/sample-app-staging/latest.yaml