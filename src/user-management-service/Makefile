tf-apply:
	cd infra;terraform init -backend-config="key=user-management-services/${ENV}/terraform.tfstate" -backend-config "bucket=${TF_STATE_BUCKET_NAME}" -backend-config "region=${AWS_REGION}" -reconfigure;terraform apply -var dd_api_key=${DD_API_KEY} -var dd_site=${DD_SITE} -var env=${ENV} -var app_version=${COMMIT_HASH} -var region=${AWS_REGION} -auto-approve

tf-apply-local:
	cd infra;terraform init -backend=false -reconfigure;terraform apply -var dd_api_key=${DD_API_KEY} -var dd_site=${DD_SITE} -var env=${ENV} -var app_version=${COMMIT_HASH} -var region=${AWS_REGION} -auto-approve

tf-destroy:
	cd infra;terraform init -backend-config="key=user-management-services/${ENV}/terraform.tfstate" -backend-config "bucket=${TF_STATE_BUCKET_NAME}" -backend-config "region=${AWS_REGION}" -reconfigure;terraform destroy -var dd_api_key=${DD_API_KEY} -var dd_site=${DD_SITE} -var env=${ENV} -var app_version=${COMMIT_HASH} -var region=${AWS_REGION} -auto-approve

sam:
	sam build --beta-features;sam deploy --stack-name UserManagement-${ENV} --parameter-overrides ParameterKey=DDApiKey,ParameterValue=${DD_API_KEY} ParameterKey=DDSite,ParameterValue=${DD_SITE} ParameterKey=Env,ParameterValue=${ENV} ParameterKey=CommitHash,ParameterValue=${COMMIT_HASH} --no-confirm-changeset --no-fail-on-empty-changeset --capabilities CAPABILITY_IAM CAPABILITY_AUTO_EXPAND --resolve-s3 --region ${AWS_REGION} --tags DD_PRESERVE_STACK=true

sam-destroy:
	sam delete --stack-name UserManagement-${ENV} --no-prompts --region ${AWS_REGION}

cdk-deploy:
	cdk deploy --all --require-approval never --concurrency 3 --region ${AWS_REGION} --tags DD_PRESERVE_STACK=true

cdk-destroy:
	cdk destroy --all --force

integration-test:
	cd src/integration_tests;cargo test

serverless-framework:
	npm i;sls deploy --region ${AWS_REGION} --stage ${ENV} --param="DD_API_KEY_SECRET_ARN=${DD_API_KEY_SECRET_ARN}" --param="DD_SITE=${DD_SITE}"

serverless-framework-destroy:
	npm i;sls remove --stage ${ENV} --param="DD_API_KEY_SECRET_ARN=${DD_API_KEY_SECRET_ARN}" --param="DD_SITE=${DD_SITE}" --"region=${AWS_REGION}" --param="COMMIT_HASH=${COMMIT_HASH}"

cleanup:
	rm -r out -f

build:
	./package.sh
