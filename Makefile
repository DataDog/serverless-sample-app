.PHONY: package-node

# Test Scripts

load:
	cd loadtest; artillery run loadtest.yml; cd ..

end-to-end-test:
	cd src/nodejs; npm i; npm run test -- product-service

# .NET
package-dotnet:
	dotnet tool install -g Amazon.Lambda.Tools;
	dotnet lambda package -pl src/dotnet/src/Analytics/Analytics.Adapters/
	dotnet lambda package -pl src/dotnet/src/Product.Api/ProductApi.Adapters/
	dotnet lambda package -pl src/dotnet/src/Inventory.Acl/Inventory.Acl.Adapters/
	dotnet lambda package -pl src/dotnet/src/Inventory.Ordering/Inventory.Ordering.Adapters/
	dotnet lambda package -pl src/dotnet/src/Product.EventPublisher/ProductEventPublisher.Adapters/
	dotnet lambda package -pl src/dotnet/src/Product.Pricing/ProductPricingService.Lambda/
	dotnet lambda package -pl src/dotnet/src/Product.Acl/Product.Acl.Adapters/

sam-dotnet:
	cd src/dotnet; npm i; sam build;sam deploy --stack-name DotnetTracing-${ENV} --parameter-overrides ParameterKey=DDApiKeySecretArn,ParameterValue=${DD_API_KEY_SECRET_ARN} ParameterKey=DDSite,ParameterValue=${DD_SITE} ParameterKey=Env,ParameterValue=${ENV} ParameterKey=CommitHash,ParameterValue=${COMMIT_HASH} --no-confirm-changeset --no-fail-on-empty-changeset --capabilities CAPABILITY_IAM CAPABILITY_AUTO_EXPAND --resolve-s3 --region ${AWS_REGION}

sam-dotnet-destroy:
	cd src/dotnet; npm i; sam delete --stack-name DotnetTracing-${ENV} --no-prompts

cdk-dotnet:
	cd src/dotnet/cdk; cdk deploy --require-approval never --all --concurrency 3

cdk-dotnet-dev:
	cd src/dotnet/cdk; cdk deploy --require-approval never --all --hotswap-fallback --concurrency 3

cdk-dotnet-destroy:
	cd src/dotnet/cdk; cdk destroy --all --force

tf-dotnet:
	cd src/dotnet/infra;terraform init -backend-config="key=dotnet/${ENV}/terraform.tfstate" -backend-config "bucket=${TF_STATE_BUCKET_NAME}" -backend-config "region=${AWS_REGION}";terraform apply -var dd_api_key_secret_arn=${DD_API_KEY_SECRET_ARN} -var dd_site=${DD_SITE} -var env=${ENV} -var app_version=${COMMIT_HASH} -var region=${AWS_REGION} -var tf_state_bucket_name=${TF_STATE_BUCKET_NAME} -auto-approve

tf-dotnet-local:
	cd src/dotnet/infra;terraform init -backend-config="key=dotnet/${ENV}/terraform.tfstate" -backend-config "bucket=${TF_STATE_BUCKET_NAME}" -backend-config "region=${AWS_REGION}" -reconfigure;terraform apply --var-file dev.tfvars

tf-dotnet-destroy:
	cd src/dotnet/infra;terraform init -backend-config="key=dotnet/${ENV}/terraform.tfstate" -backend-config "bucket=${TF_STATE_BUCKET_NAME}" -backend-config "region=${AWS_REGION}";terraform destroy -var dd_api_key_secret_arn=${DD_API_KEY_SECRET_ARN} -var dd_site=${DD_SITE} -var env=${ENV} -var app_version=${COMMIT_HASH} -var region=${AWS_REGION} -var tf_state_bucket_name=${TF_STATE_BUCKET_NAME} -auto-approve

tf-dotnet-local-destroy:
	cd src/dotnet/infra;terraform init -backend-config="key=dotnet/${ENV}/terraform.tfstate" -backend-config "bucket=${TF_STATE_BUCKET_NAME}" -backend-config "region=${AWS_REGION}";terraform destroy --var-file dev.tfvars

# Java

package-java:
	cd src/java;mvn clean package

sam-java:
	cd src/java; sam build;sam deploy --stack-name JavaTracing-${ENV} --parameter-overrides ParameterKey=DDApiKeySecretArn,ParameterValue=${DD_API_KEY_SECRET_ARN} ParameterKey=DDSite,ParameterValue=${DD_SITE} ParameterKey=Env,ParameterValue=${ENV} ParameterKey=CommitHash,ParameterValue=${COMMIT_HASH} --no-confirm-changeset --no-fail-on-empty-changeset --capabilities CAPABILITY_IAM CAPABILITY_AUTO_EXPAND --resolve-s3 --region ${AWS_REGION}

sam-java-destroy:
	cd src/java; sam delete --stack-name JavaTracing-${ENV} --no-prompts

cdk-java:
	cd src/java;mvn clean package;cd cdk;cdk deploy --all --require-approval never --concurrency 3

cdk-java-destroy:
	cd src/java;mvn clean package;cd cdk;cdk destroy --all --force

tf-java:
	cd src/java/infra;terraform init -backend-config="key=java/${ENV}/terraform.tfstate" -backend-config "bucket=${TF_STATE_BUCKET_NAME}" -backend-config "region=${AWS_REGION}";terraform apply -var dd_api_key_secret_arn=${DD_API_KEY_SECRET_ARN} -var dd_site=${DD_SITE} -var env=${ENV} -var app_version=${COMMIT_HASH} -var region=${AWS_REGION} -var tf_state_bucket_name=${TF_STATE_BUCKET_NAME} -auto-approve

tf-java-plan:
	cd src/java/infra;terraform init -backend-config="key=java/${ENV}/terraform.tfstate" -backend-config "bucket=${TF_STATE_BUCKET_NAME}" -backend-config "region=${AWS_REGION}";terraform plan --var-file dev.tfvars

tf-java-local:
	cd src/java/infra;terraform init -backend-config="key=java/${ENV}/terraform.tfstate" -backend-config "bucket=${TF_STATE_BUCKET_NAME}" -backend-config "region=${AWS_REGION}" -reconfigure;terraform apply --var-file dev.tfvars

tf-java-destroy:
	cd src/java/infra;terraform init -backend-config="key=java/${ENV}/terraform.tfstate" -backend-config "bucket=${TF_STATE_BUCKET_NAME}" -backend-config "region=${AWS_REGION}";terraform destroy -var dd_api_key_secret_arn=${DD_API_KEY_SECRET_ARN} -var dd_site=${DD_SITE} -var env=${ENV} -var app_version=${COMMIT_HASH} -var region=${AWS_REGION} -var tf_state_bucket_name=${TF_STATE_BUCKET_NAME} -auto-approve

tf-java-local-destroy:
	cd src/java/infra;terraform init -backend-config="key=java/${ENV}/terraform.tfstate" -backend-config="key=java/${ENV}/terraform.tfstate" -backend-config "bucket=${TF_STATE_BUCKET_NAME}" -backend-config "region=${AWS_REGION}";terraform destroy --var-file dev.tfvars

# NodeJS

package-node:
	cd src/nodejs;./package.sh

sam-nodejs:
	cd src/nodejs; npm i; sam build;sam deploy --stack-name NodeTracing-${ENV} --parameter-overrides ParameterKey=DDApiKeySecretArn,ParameterValue=${DD_API_KEY_SECRET_ARN} ParameterKey=DDSite,ParameterValue=${DD_SITE} ParameterKey=Env,ParameterValue=${ENV} ParameterKey=CommitHash,ParameterValue=${COMMIT_HASH} --no-confirm-changeset --no-fail-on-empty-changeset --capabilities CAPABILITY_IAM CAPABILITY_AUTO_EXPAND --resolve-s3 --region ${AWS_REGION}

sam-nodejs-destroy:
	cd src/nodejs; npm i; sam delete --stack-name NodeTracing-${ENV} --no-prompts --region ${AWS_REGION}

cdk-nodejs:
	cd src/nodejs; npm i; cdk deploy --require-approval never --all --concurrency 3

cdk-nodejs-destroy:
	cd src/nodejs; npm i; cdk destroy --all --force

tf-node: package-node
	cd src/nodejs/infra;terraform init -backend-config="key=nodejs/${ENV}/terraform.tfstate" -backend-config "bucket=${TF_STATE_BUCKET_NAME}" -backend-config "region=${AWS_REGION}";terraform apply -var dd_api_key_secret_arn=${DD_API_KEY_SECRET_ARN} -var dd_site=${DD_SITE} -var env=${ENV} -var app_version=${COMMIT_HASH} -var region=${AWS_REGION} -var tf_state_bucket_name=${TF_STATE_BUCKET_NAME} -auto-approve

tf-node-local: package-node
	cd src/nodejs/infra;terraform init -reconfigure -backend-config="key=nodejs/${ENV}/terraform.tfstate" -backend-config "bucket=${TF_STATE_BUCKET_NAME}" -backend-config "region=${AWS_REGION}";terraform apply --var-file dev.tfvars

tf-node-destroy:
	cd src/nodejs/infra;terraform init -backend-config="key=nodejs/${ENV}/terraform.tfstate" -backend-config "bucket=${TF_STATE_BUCKET_NAME}" -backend-config "region=${AWS_REGION}";terraform destroy -var dd_api_key_secret_arn=${DD_API_KEY_SECRET_ARN} -var dd_site=${DD_SITE} -var env=${ENV} -var app_version=${COMMIT_HASH} -var region=${AWS_REGION} -var tf_state_bucket_name=${TF_STATE_BUCKET_NAME} -auto-approve

tf-node-local-destroy:
	cd src/nodejs/infra;terraform init -backend-config="key=nodejs/${ENV}/terraform.tfstate" -backend-config "bucket=${TF_STATE_BUCKET_NAME}" -backend-config "region=${AWS_REGION}";terraform destroy -var-file dev.tfvars

# Rust

package-rust:
	cd src/rust;./package.sh

sam-rust:
	cd src/rust; npm i; sam build --beta-features;sam deploy --stack-name RustTracing-${ENV} --parameter-overrides ParameterKey=DDApiKeySecretArn,ParameterValue=${DD_API_KEY_SECRET_ARN} ParameterKey=DDSite,ParameterValue=${DD_SITE} ParameterKey=Env,ParameterValue=${ENV} ParameterKey=CommitHash,ParameterValue=${COMMIT_HASH} --no-confirm-changeset --no-fail-on-empty-changeset --capabilities CAPABILITY_IAM CAPABILITY_AUTO_EXPAND --resolve-s3 --region ${AWS_REGION}

sam-rust-destroy:
	cd src/rust; npm i; sam delete --stack-name RustTracing-${ENV} --no-prompts

cdk-rust-dev:
	cd src/rust; npm i; cdk deploy --require-approval never --all --hotswap-fallback --concurrency 3

cdk-rust:
	cd src/rust; npm i; cdk deploy --require-approval never --all --concurrency 3

cdk-rust-destroy:
	cd src/rust; cdk destroy --all --force

tf-rust: package-rust
	cd src/rust/infra;terraform init -backend-config="key=rust/${ENV}/terraform.tfstate" -backend-config "bucket=${TF_STATE_BUCKET_NAME}" -backend-config "region=${AWS_REGION}";terraform apply -var dd_api_key_secret_arn=${DD_API_KEY_SECRET_ARN} -var dd_site=${DD_SITE} -var env=${ENV} -var app_version=${COMMIT_HASH} -var region=${AWS_REGION} -var tf_state_bucket_name=${TF_STATE_BUCKET_NAME} -auto-approve

tf-rust-local: package-rust
	cd src/rust/infra;terraform init -backend-config="key=rust/${ENV}/terraform.tfstate" -backend-config "bucket=${TF_STATE_BUCKET_NAME}" -backend-config "region=${AWS_REGION}";terraform apply --var-file dev.tfvars

tf-rust-destroy:
	cd src/rust/infra;terraform init -backend-config="key=rust/${ENV}/terraform.tfstate" -backend-config "bucket=${TF_STATE_BUCKET_NAME}" -backend-config "region=${AWS_REGION}";terraform destroy -var dd_api_key_secret_arn=${DD_API_KEY_SECRET_ARN} -var dd_site=${DD_SITE} -var env=${ENV} -var app_version=${COMMIT_HASH} -var region=${AWS_REGION} -var tf_state_bucket_name=${TF_STATE_BUCKET_NAME} -auto-approve

tf-rust-local-destroy:
	cd src/rust/infra;terraform init -backend-config="key=rust/${ENV}/terraform.tfstate" -backend-config "bucket=${TF_STATE_BUCKET_NAME}" -backend-config "region=${AWS_REGION}";terraform destroy --var-file dev.tfvars

# Go

cdk-go:
	cd src/go/cdk; cdk deploy --require-approval never --all --concurrency 3

cdk-go-destroy:
	cd src/go/cdk; cdk destroy --all --force

sam-go:
	cd src/go; npm i; sam build;sam deploy --stack-name GoTracing-${ENV} --parameter-overrides ParameterKey=DDApiKeySecretArn,ParameterValue=${DD_API_KEY_SECRET_ARN} ParameterKey=DDSite,ParameterValue=${DD_SITE} ParameterKey=Env,ParameterValue=${ENV} ParameterKey=CommitHash,ParameterValue=${COMMIT_HASH} --no-confirm-changeset --no-fail-on-empty-changeset --capabilities CAPABILITY_IAM CAPABILITY_AUTO_EXPAND --resolve-s3 --region ${AWS_REGION}

sam-go-destroy:
	cd src/go; npm i; sam delete --stack-name GoTracing-${ENV} --no-prompts

