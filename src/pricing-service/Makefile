tf-apply:
	cd infra;terraform init -backend-config="key=pricing-service/${ENV}/terraform.tfstate" -backend-config "bucket=${TF_STATE_BUCKET_NAME}" -backend-config "region=${AWS_REGION}" -reconfigure;terraform apply -var dd_api_key=${DD_API_KEY} -var dd_site=${DD_SITE} -var env=${ENV} -var app_version=${COMMIT_HASH} -var region=${AWS_REGION} -auto-approve

tf-apply-local:
	cd infra;terraform init -backend=false -reconfigure;terraform apply -var dd_api_key=${DD_API_KEY} -var dd_site=${DD_SITE} -var env=${ENV} -var app_version=${COMMIT_HASH} -var region=${AWS_REGION} -auto-approve

tf-destroy:
	cd infra;terraform init -backend-config="key=pricing-service/${ENV}/terraform.tfstate" -backend-config "bucket=${TF_STATE_BUCKET_NAME}" -backend-config "region=${AWS_REGION}" -reconfigure;terraform destroy -var dd_api_key=${DD_API_KEY} -var dd_site=${DD_SITE} -var env=${ENV} -var app_version=${COMMIT_HASH} -var region=${AWS_REGION} -auto-approve

sam:
	sam build;sam deploy --stack-name PricingService-${ENV} --parameter-overrides ParameterKey=DDApiKey,ParameterValue=${DD_API_KEY} ParameterKey=DDSite,ParameterValue=${DD_SITE} ParameterKey=Env,ParameterValue=${ENV} ParameterKey=CommitHash,ParameterValue=${COMMIT_HASH} --no-confirm-changeset --no-fail-on-empty-changeset --capabilities CAPABILITY_IAM CAPABILITY_AUTO_EXPAND --resolve-s3 --region ${AWS_REGION} --tags DD_PRESERVE_STACK=true

sam-destroy:
	sam delete --stack-name PricingService-${ENV} --no-prompts

cdk-deploy: build
	cdk deploy --all --require-approval never --concurrency 3 --region ${AWS_REGION} --tags DD_PRESERVE_STACK=true

cdk-destroy:
	cdk destroy --all --force

integration-test:
	npm run test

build:
	./package.sh