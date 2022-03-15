#!/bin/bash

# Unless explicitly stated otherwise all files in this repository are licensed
# under the Apache License Version 2.0.
# This product includes software developed at Datadog (https://www.datadoghq.com/).
# Copyright 2022 Datadog, Inc.

# Usage: ./publish.sh <Desired Version> <Account [sandbox|prod]>
# When publishing to sandbox, the template version number is NOT updated and no github release is created!

set -e

CURRENT_VERSION=$(grep -o 'Version: \d\+\.\d\+\.\d\+' template.yaml | cut -d' ' -f2)

# Read the desired version
if [ -z "$1" ]; then
    echo "ERROR: You must specify a desired version number"
    exit 1
elif [[ ! $1 =~ [0-9]+\.[0-9]+\.[0-9]+ ]]; then
    echo "ERROR: You must use a semantic version (e.g. 3.1.4)"
    exit 1
else
    SAMPLE_APP_VERSION=$1
fi

# Check account parameter
VALID_ACCOUNTS=("sandbox" "prod")
if [ -z "$2" ]; then
    echo "ERROR: You must pass an account parameter. Please choose sandbox or prod."
    exit 1
fi
if [[ ! "${VALID_ACCOUNTS[@]}" =~ $2 ]]; then
    echo "ERROR: The account parameter was invalid. Please choose sandbox or prod."
    exit 1
fi

ACCOUNT="${2}"

if [ "$ACCOUNT" = "sandbox" ]; then
    BUCKET="datadog-cloudformation-template-sandbox"
fi
if [ "$ACCOUNT" = "prod" ]; then
    BUCKET="datadog-cloudformation-template"
fi

function aws-login() {
    cfg=( "$@" )
    shift
    if [ "$ACCOUNT" = "prod" ] ; then
        aws-vault exec prod-engineering --  ${cfg[@]}
    else
        aws-vault exec sandbox-account-admin --  ${cfg[@]}
    fi
}

echo "Injecting lambda code into CloudFormation template"
rm -rf dist
mkdir dist

awk -v STRING_TO_REPLACE="INJECT_ENTRY_FUNCTION_CODE_PLACEHOLDER" -f inject_inline_code.awk handler.py template.yaml > dist/template.yaml
awk -v STRING_TO_REPLACE="INJECT_SQS_CONSUMER_CODE_PLACEHOLDER" -f inject_inline_code.awk handler.js dist/template.yaml > tmp && mv tmp dist/template.yaml

# Validate the template
echo "Validating template.yaml..."
aws-login aws cloudformation validate-template --template-body file://dist/template.yaml
echo "Uploading the CloudFormation Template"
if [ "$ACCOUNT" = "prod" ]; then
    # Make sure we are on the master branch
    BRANCH=$(git rev-parse --abbrev-ref HEAD)
    if [ $BRANCH != "main" ]; then
        echo "ERROR: Not on the master branch, aborting."
        exit 1
    fi

    # Confirm to proceed
    echo
    read -p "About to bump the version from ${CURRENT_VERSION} to ${SAMPLE_APP_VERSION}, create a release of v${SAMPLE_APP_VERSION} on GitHub, upload the template.yaml to s3://${BUCKET}/aws/sample-app/${SAMPLE_APP_VERSION}.yaml. Continue (y/n)?" CONT
    if [ "$CONT" != "y" ]; then
        echo "Exiting..."
        exit 1
    fi

    # Get the latest code
    git pull origin main

    # Bump version number in settings.py and template.yml
    echo "Bumping the version number to ${SAMPLE_APP_VERSION}..."
    perl -pi -e "s/Version: [0-9\.]+/Version: ${SAMPLE_APP_VERSION}/g" template.yaml
    perl -pi -e "s/Version: [0-9\.]+/Version: ${SAMPLE_APP_VERSION}/g" dist/template.yaml

    # Commit version number changes to git
    echo "Committing version number change..."
    git add template.yaml
    git commit -m "Bump version from ${CURRENT_VERSION} to ${SAMPLE_APP_VERSION}"
    git push origin master

    # Create a GitHub release
    echo
    echo "Releasing v${SAMPLE_APP_VERSION} to GitHub..."
    go get github.com/github/hub

    # "-a $BUNDLE_PATH" to include assets in github release
    hub release create -m "v${SAMPLE_APP_VERSION}" v${SAMPLE_APP_VERSION}

    aws-login aws s3 cp dist/template.yaml s3://${BUCKET}/aws/serverless-sample-app/${SAMPLE_APP_VERSION}.yaml \
        --grants read=uri=http://acs.amazonaws.com/groups/global/AllUsers
    aws-login aws s3 cp dist/template.yaml s3://${BUCKET}/aws/serverless-sample-app/latest.yaml \
        --grants read=uri=http://acs.amazonaws.com/groups/global/AllUsers
    TEMPLATE_URL="https://${BUCKET}.s3.amazonaws.com/aws/serverless-sample-app/latest.yaml"
else
    aws-login aws s3 cp dist/template.yaml s3://${BUCKET}/aws/serverless-sample-app-staging/${SAMPLE_APP_VERSION}.yaml
    aws-login aws s3 cp dist/template.yaml s3://${BUCKET}/aws/serverless-sample-app-staging/latest.yaml
    TEMPLATE_URL="https://${BUCKET}.s3.amazonaws.com/aws/serverless-sample-app-staging/latest.yaml"
    echo "CURRENT_VERSION: $CURRENT_VERSION"
    echo "SAMPLE_APP_VERSION: $SAMPLE_APP_VERSION"
    echo "ACCOUNT: $ACCOUNT"
    echo "TEMPLATE_URL: $TEMPLATE_URL"
    echo "BUCKET: $BUCKET"
fi

echo "Done uploading the CloudFormation template!"
echo
echo "Here is the CloudFormation quick launch URL:"
echo "https://console.aws.amazon.com/cloudformation/home#/stacks/create/review?stackName=datadog-serverless-sample-app&templateURL=${TEMPLATE_URL}"
echo
echo "Serverless Sample App release process complete!"

if [ "$ACCOUNT" = "prod" ] ; then
    echo "Don't forget to add release notes in GitHub!"
fi