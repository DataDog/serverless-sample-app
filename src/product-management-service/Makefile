tf-apply:
	cd infra;terraform init -backend-config="key=product-management-services/${ENV}/terraform.tfstate" -backend-config "bucket=${TF_STATE_BUCKET_NAME}" -backend-config "region=${AWS_REGION}";terraform apply -var dd_api_key_secret_arn=${DD_API_KEY_SECRET_ARN} -var dd_site=${DD_SITE} -var env=${ENV} -var app_version=${COMMIT_HASH} -var region=${AWS_REGION} -auto-approve

tf-destroy:
	cd infra;terraform init -backend-config="key=product-management-services/${ENV}/terraform.tfstate" -backend-config "bucket=${TF_STATE_BUCKET_NAME}" -backend-config "region=${AWS_REGION}";terraform destroy -var dd_api_key_secret_arn=${DD_API_KEY_SECRET_ARN} -var dd_site=${DD_SITE} -var env=${ENV} -var app_version=${COMMIT_HASH} -var region=${AWS_REGION} -auto-approve

sam:
	sam build;sam deploy --stack-name ProductManagementService-${ENV} --parameter-overrides ParameterKey=DDApiKeySecretArn,ParameterValue=${DD_API_KEY_SECRET_ARN} ParameterKey=DDSite,ParameterValue=${DD_SITE} ParameterKey=Env,ParameterValue=${ENV} ParameterKey=CommitHash,ParameterValue=${COMMIT_HASH} --no-confirm-changeset --no-fail-on-empty-changeset --capabilities CAPABILITY_IAM CAPABILITY_AUTO_EXPAND --resolve-s3 --region ${AWS_REGION}

cdk:
	cd cdk;cdk deploy --all --require-approval never --concurrency 3 --region ${AWS_REGION}

deploy:
	sam deploy \
		--template-file deployments/template.yaml \
	    --stack-name remove-me-test-cookiecutter \
	    --s3-bucket $(shell aws ssm get-parameter --name sam-bucket-name --query "Parameter.Value" --output text) \
	    --s3-prefix=product-api \
	    --no-confirm-changeset --no-fail-on-empty-changeset \
		--tags Project=PRODUCT-API \
        --parameter-overrides \
            LogLevel="INFO" \
		--capabilities CAPABILITY_IAM CAPABILITY_AUTO_EXPAND

cleanup:
	rm -r out -f

pre-build:
	mkdir out
	mkdir out/GetProduct
	mkdir out/ListProducts
	mkdir out/CreateProduct
	mkdir out/DeleteProduct
	mkdir out/UpdateProduct
	mkdir out/PriceCalculatedHandlerFunction
	mkdir out/StockUpdatedHandlerFunction
	mkdir out/ProductPublicEventPublisher
	mkdir out/ProductAcl

build: package-api-functions package-product-acl package-api-worker-functions package-event-publisher-functions

package-api-functions: package-GetProductFunction package-CreateProductFunction package-DeleteProductFunction package-UpdateProductFunction package-ListProductsFunction

package-product-acl: package-ProductAclFunction

package-api-worker-functions: package-ProductApiPricingWorker package-ProductApiStockUpdatedWorker

package-event-publisher-functions: package-ProductPublicEventPublisher

package-GetProductFunction:
	cd src/product-api;go mod tidy;GOOS=linux GOARCH=arm64 go build -o bootstrap get-product/main.go;cp bootstrap ../../out/GetProduct/bootstrap
	zip -r -j out/GetProduct/GetProduct.zip out/GetProduct/bootstrap

package-CreateProductFunction:
	cd src/product-api;go mod tidy;GOOS=linux GOARCH=arm64 go build -o bootstrap create-product/main.go;cp bootstrap ../../out/CreateProduct/bootstrap
	zip -r -j out/CreateProduct/CreateProduct.zip out/CreateProduct/bootstrap

package-DeleteProductFunction:
	cd src/product-api;go mod tidy;GOOS=linux GOARCH=arm64 go build -o bootstrap delete-product/main.go;cp bootstrap ../../out/DeleteProduct/bootstrap
	zip -r -j out/DeleteProduct/DeleteProduct.zip out/DeleteProduct/bootstrap

package-UpdateProductFunction:
	cd src/product-api;go mod tidy;GOOS=linux GOARCH=arm64 go build -o bootstrap update-product/main.go;cp bootstrap ../../out/UpdateProduct/bootstrap
	zip -r -j out/UpdateProduct/UpdateProduct.zip out/UpdateProduct/bootstrap

package-ListProductsFunction:
	cd src/product-api;go mod tidy;GOOS=linux GOARCH=arm64 go build -o bootstrap list-products/main.go;cp bootstrap ../../out/ListProducts/bootstrap
	zip -r -j out/ListProducts/ListProducts.zip out/ListProducts/bootstrap

package-ProductApiPricingWorker:
	cd src/product-api;go mod tidy;GOOS=linux GOARCH=arm64 go build -o bootstrap handle-pricing-changed/main.go;cp bootstrap ../../out/PriceCalculatedHandlerFunction/bootstrap
	zip -r -j out/PriceCalculatedHandlerFunction/PriceCalculatedHandlerFunction.zip out/PriceCalculatedHandlerFunction/bootstrap

package-ProductApiStockUpdatedWorker:
	cd src/product-api;go mod tidy;GOOS=linux GOARCH=arm64 go build -o bootstrap handle-stock-updated/main.go;cp bootstrap ../../out/StockUpdatedHandlerFunction/bootstrap
	zip -r -j out/StockUpdatedHandlerFunction/StockUpdatedHandlerFunction.zip out/StockUpdatedHandlerFunction/bootstrap

package-ProductAclFunction:
	cd src/product-acl;go mod tidy;GOOS=linux GOARCH=arm64 go build -o bootstrap inventory-stock-updated-event-handler/main.go;cp bootstrap ../../out/ProductAcl/bootstrap
	zip -r -j out/ProductAcl/ProductAcl.zip out/ProductAcl/bootstrap

package-ProductPublicEventPublisher:
	cd src/product-event-publisher;go mod tidy;GOOS=linux GOARCH=arm64 go build -o bootstrap public-event-publisher/main.go;cp bootstrap ../../out/ProductPublicEventPublisher/bootstrap
	zip -r -j out/ProductPublicEventPublisher/ProductPublicEventPublisher.zip out/ProductPublicEventPublisher/bootstrap

build-GetProductFunction:
	cd src/product-api;go mod tidy;GOOS=linux GOARCH=arm64 go build -o bootstrap get-product/main.go;cp bootstrap $(ARTIFACTS_DIR)/bootstrap

build-CreateProductFunction:
	cd src/product-api;go mod tidy;GOOS=linux GOARCH=arm64 go build -o bootstrap create-product/main.go;cp bootstrap $(ARTIFACTS_DIR)/bootstrap

build-DeleteProductFunction:
	cd src/product-api;go mod tidy;GOOS=linux GOARCH=arm64 go build -o bootstrap delete-product/main.go;cp bootstrap $(ARTIFACTS_DIR)/bootstrap

build-UpdateProductFunction:
	cd src/product-api;go mod tidy;GOOS=linux GOARCH=arm64 go build -o bootstrap update-product/main.go;cp bootstrap $(ARTIFACTS_DIR)/bootstrap

build-ListProductsFunction:
	cd src/product-api;go mod tidy;GOOS=linux GOARCH=arm64 go build -o bootstrap list-products/main.go;cp bootstrap $(ARTIFACTS_DIR)/bootstrap

build-ProductApiPricingWorker:
	cd src/product-api;go mod tidy;GOOS=linux GOARCH=arm64 go build -o bootstrap handle-pricing-changed/main.go;cp bootstrap $(ARTIFACTS_DIR)/bootstrap

build-ProductApiStockUpdatedWorker:
	cd src/product-api;go mod tidy;GOOS=linux GOARCH=arm64 go build -o bootstrap handle-stock-updated/main.go;cp bootstrap $(ARTIFACTS_DIR)/bootstrap

build-ProductPublicEventPublisher:
	cd src/product-event-publisher;go mod tidy;GOOS=linux GOARCH=arm64 go build -o bootstrap public-event-publisher/main.go;cp bootstrap $(ARTIFACTS_DIR)/bootstrap

build-ProductInventoryStockUpdatedHandler:
	cd src/product-acl;go mod tidy;GOOS=linux GOARCH=arm64 go build -o bootstrap inventory-stock-updated-event-handler/main.go;cp bootstrap $(ARTIFACTS_DIR)/bootstrap

