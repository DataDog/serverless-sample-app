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

cdk-dotnet:
	cd src/dotnet/cdk; cdk deploy --require-approval never --all --concurrency 3

cdk-dotnet-dev:
	cd src/dotnet/cdk; cdk deploy --require-approval never --all --hotswap-fallback --concurrency 3

cdk-dotnet-destroy:
	cd src/dotnet/cdk; cdk destroy --all --force

tf-dotnet:
	cd src/dotnet/infra;terraform init -backend-config="key=dotnet/${ENV}/terraform.tfstate" -backend-config "bucket=${TF_STATE_BUCKET_NAME}" -backend-config "region=${AWS_REGION}";terraform apply -var dd_api_key_secret_arn=${DD_API_KEY_SECRET_ARN} -var dd_site=${DD_SITE} -var env=${ENV} -var app_version=${COMMIT_HASH} -var region=${AWS_REGION} -var tf_state_bucket_name=${TF_STATE_BUCKET_NAME} -auto-approve

tf-dotnet-local:
	cd src/dotnet/infra;terraform init -backend-config="key=dotnet/${ENV}/terraform.tfstate" -backend-config "bucket=${TF_STATE_BUCKET_NAME}" -backend-config "region=${AWS_REGION}";terraform apply --var-file dev.tfvars

tf-dotnet-destroy:
	cd src/dotnet/infra;terraform init -backend-config="key=dotnet/${ENV}/terraform.tfstate" -backend-config "bucket=${TF_STATE_BUCKET_NAME}" -backend-config "region=${AWS_REGION}";terraform destroy -var dd_api_key_secret_arn=${DD_API_KEY_SECRET_ARN} -var dd_site=${DD_SITE} -var env=${ENV} -var app_version=${COMMIT_HASH} -var region=${AWS_REGION} -var tf_state_bucket_name=${TF_STATE_BUCKET_NAME} -auto-approve

tf-dotnet-local-destroy:
	cd src/dotnet/infra;terraform init -backend-config="key=dotnet/${ENV}/terraform.tfstate" -backend-config "bucket=${TF_STATE_BUCKET_NAME}" -backend-config "region=${AWS_REGION}";terraform destroy --var-file dev.tfvars

sam-dotnet:
	cd src/dotnet; sam build;sam deploy --stack-name DotnetTracing --parameter-overrides "ParameterKey=DDApiKeySecretArn,ParameterValue=${DD_API_KEY_SECRET_ARN}" "ParameterKey=DDSite,ParameterValue=${DD_SITE}" --resolve-s3 --capabilities CAPABILITY_IAM CAPABILITY_AUTO_EXPAND --region ${AWS_REGION}

sam-dotnet-destroy:
	cd src/dotnet; sam delete --stack-name DotnetTracing --region ${AWS_REGION} --no-prompts

# Java

package-java:
	cd src/java;mvn clean package

cdk-java:
	cd src/java;mvn clean package;cd cdk;cdk deploy --all --require-approval never --concurrency 3

cdk-java-destroy:
	cd src/java;mvn clean package;cd cdk;cdk destroy --all --force

tf-java:
	cd src/java/infra;terraform init -backend-config="key=java/${ENV}/terraform.tfstate" -backend-config "bucket=${TF_STATE_BUCKET_NAME}" -backend-config "region=${AWS_REGION}";terraform apply -var dd_api_key_secret_arn=${DD_API_KEY_SECRET_ARN} -var dd_site=${DD_SITE} -var env=${ENV} -var app_version=${COMMIT_HASH} -var region=${AWS_REGION} -var tf_state_bucket_name=${TF_STATE_BUCKET_NAME} -auto-approve

tf-java-plan:
	cd src/java/infra;terraform init -backend-config="key=java/${ENV}/terraform.tfstate" -backend-config "bucket=${TF_STATE_BUCKET_NAME}" -backend-config "region=${AWS_REGION}";terraform plan --var-file dev.tfvars

tf-java-local:
	cd src/java/infra;terraform init -backend-config="key=java/${ENV}/terraform.tfstate" -backend-config "bucket=${TF_STATE_BUCKET_NAME}" -backend-config "region=${AWS_REGION}";terraform apply --var-file dev.tfvars

tf-java-destroy:
	cd src/java/infra;terraform init -backend-config="key=java/${ENV}/terraform.tfstate" -backend-config "bucket=${TF_STATE_BUCKET_NAME}" -backend-config "region=${AWS_REGION}";terraform destroy -var dd_api_key_secret_arn=${DD_API_KEY_SECRET_ARN} -var dd_site=${DD_SITE} -var env=${ENV} -var app_version=${COMMIT_HASH} -var region=${AWS_REGION} -var tf_state_bucket_name=${TF_STATE_BUCKET_NAME} -auto-approve

tf-java-local-destroy:
	cd src/java/infra;terraform init -backend-config="key=java/${ENV}/terraform.tfstate" -backend-config="key=java/${ENV}/terraform.tfstate" -backend-config "bucket=${TF_STATE_BUCKET_NAME}" -backend-config "region=${AWS_REGION}";terraform destroy --var-file dev.tfvars

# NodeJS

package-node:
	cd src/nodejs;./package.sh

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

