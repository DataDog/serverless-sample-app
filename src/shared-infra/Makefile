tf-apply:
	cd infra;terraform init -backend-config="key=shared-services/${ENV}/terraform.tfstate" -backend-config "bucket=${TF_STATE_BUCKET_NAME}" -backend-config "region=${AWS_REGION}";terraform apply -var dd_api_key=${DD_API_KEY} -var dd_site=${DD_SITE} -var env=${ENV} -var app_version=${COMMIT_HASH} -var region=${AWS_REGION} -var dd_api_key=${DD_API_KEY} -auto-approve

tf-destroy:
	cd infra;terraform init -backend-config="key=shared-services/${ENV}/terraform.tfstate" -backend-config "bucket=${TF_STATE_BUCKET_NAME}" -backend-config "region=${AWS_REGION}";terraform destroy -var dd_api_key=${DD_API_KEY} -var dd_site=${DD_SITE} -var env=${ENV} -var app_version=${COMMIT_HASH} -var region=${AWS_REGION} -var dd_api_key=${DD_API_KEY} -auto-approve

sam:
	sam build;sam deploy --stack-name SharedServices-${ENV} --parameter-overrides ParameterKey=DDApiKeySecretArn,ParameterValue=${DD_API_KEY_SECRET_ARN} ParameterKey=DDSite,ParameterValue=${DD_SITE} ParameterKey=Env,ParameterValue=${ENV} ParameterKey=CommitHash,ParameterValue=${COMMIT_HASH} ParameterKey=DDApiKey,ParameterValue=${DD_API_KEY} --no-confirm-changeset --no-fail-on-empty-changeset --capabilities CAPABILITY_IAM CAPABILITY_AUTO_EXPAND --resolve-s3 --region ${AWS_REGION} --tags DD_PRESERVE_STACK=true

cdk:
	cdk deploy --all --require-approval never --concurrency 3 --region ${AWS_REGION} --tags DD_PRESERVE_STACK=true

serverless-framework:
	sls deploy --region ${AWS_REGION} --stage ${ENV} --param="DD_API_KEY=${DD_API_KEY}"