build: test
	sam build -b deployments/

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

tf-pre-build:
	mkdir out
	mkdir out/GoGetProduct
	mkdir out/GoListProducts
	mkdir out/GoCreateProduct
	mkdir out/GoDeleteProduct
	mkdir out/GoUpdateProduct
	mkdir out/GoProductCreatedPricingHandler
	mkdir out/GoProductUpdatedPricingHandler
	mkdir out/PriceCalculatedHandlerFunction
	mkdir out/GoProductPublicEventPublisher
	mkdir out/GoInventoryAcl
	mkdir out/GoInventoryOrderingService
	mkdir out/GoAnalyticsBackend
	
tf-local-deploy: tf-pre-build package-api-functions package-pricing-functions package-api-worker-functions package-event-publisher-functions package-inventory-acl-functions package-inventory-ordering-functions package-event-analytics-functions tf-local-apply

tf-deploy: tf-pre-build package-api-functions package-pricing-functions package-api-worker-functions package-event-publisher-functions package-inventory-acl-functions package-inventory-ordering-functions package-event-analytics-functions tf-apply

tf-local-apply:
	cd infra;terraform init -backend-config "bucket=${TF_STATE_BUCKET_NAME}" -backend-config "region=${AWS_REGION}";terraform apply --var-file dev.tfvars

tf-local-destroy:
	cd infra;terraform apply --var-file dev.tfvars

tf-apply:
	cd infra;terraform init -backend-config "bucket=${TF_STATE_BUCKET_NAME}" -backend-config "region=${AWS_REGION}";terraform apply -var dd_api_key_secret_arn=${DD_SECRET_ARN} -var dd_site=${DD_SITE} -var env=${ENV} -var app_version=${COMMIT_HASH} -var region=${AWS_REGION} -var tf_state_bucket_name=${TF_STATE_BUCKET_NAME} -auto-approve

tf-destroy:
	cd infra;terraform init -backend-config "bucket=${TF_STATE_BUCKET_NAME}" -backend-config "region=${AWS_REGION}";terraform destroy -var dd_api_key_secret_arn=${DD_SECRET_ARN} -var dd_site=${DD_SITE} -var env=${ENV} -var app_version=${COMMIT_HASH} -var region=${AWS_REGION} -var tf_state_bucket_name=${TF_STATE_BUCKET_NAME} -auto-approve

package-api-functions: package-GetProductFunction package-CreateProductFunction package-DeleteProductFunction package-UpdateProductFunction package-ListProductsFunction

package-pricing-functions: package-ProductUpdatedPricingServiceFunction package-ProductCreatedPricingServiceFunction

package-api-worker-functions: package-ProductApiPricingWorker

package-event-publisher-functions: package-ProductPublicEventPublisher

package-inventory-acl-functions: package-InventoryProductCreatedHandler

package-inventory-ordering-functions: package-InventoryOrderingWorkflow

package-event-analytics-functions: package-GoAnalyticsBackend

package-GetProductFunction:
	cd src/product-api;go mod tidy;GOOS=linux GOARCH=arm64 go build -o bootstrap get-product/main.go;cp bootstrap ../../out/GoGetProduct/bootstrap
	zip -r -j out/GoGetProduct/GoGetProduct.zip out/GoGetProduct/bootstrap

package-CreateProductFunction:
	cd src/product-api;go mod tidy;GOOS=linux GOARCH=arm64 go build -o bootstrap create-product/main.go;cp bootstrap ../../out/GoCreateProduct/bootstrap
	zip -r -j out/GoCreateProduct/GoCreateProduct.zip out/GoCreateProduct/bootstrap

package-DeleteProductFunction:
	cd src/product-api;go mod tidy;GOOS=linux GOARCH=arm64 go build -o bootstrap delete-product/main.go;cp bootstrap ../../out/GoDeleteProduct/bootstrap
	zip -r -j out/GoDeleteProduct/GoDeleteProduct.zip out/GoDeleteProduct/bootstrap

package-UpdateProductFunction:
	cd src/product-api;go mod tidy;GOOS=linux GOARCH=arm64 go build -o bootstrap update-product/main.go;cp bootstrap ../../out/GoUpdateProduct/bootstrap
	zip -r -j out/GoUpdateProduct/GoUpdateProduct.zip out/GoUpdateProduct/bootstrap

package-ListProductsFunction:
	cd src/product-api;go mod tidy;GOOS=linux GOARCH=arm64 go build -o bootstrap list-products/main.go;cp bootstrap ../../out/GoListProducts/bootstrap
	zip -r -j out/GoListProducts/GoListProducts.zip out/GoListProducts/bootstrap

package-ProductUpdatedPricingServiceFunction:
	cd src/product-pricing-service;go mod tidy;GOOS=linux GOARCH=arm64 go build -o bootstrap handle-product-updated/main.go;cp bootstrap ../../out/GoProductUpdatedPricingHandler/bootstrap
	zip -r -j out/GoProductUpdatedPricingHandler/GoProductUpdatedPricingHandler.zip out/GoProductUpdatedPricingHandler/bootstrap

package-ProductCreatedPricingServiceFunction:
	cd src/product-pricing-service;go mod tidy;GOOS=linux GOARCH=arm64 go build -o bootstrap handle-product-created/main.go;cp bootstrap ../../out/GoProductCreatedPricingHandler/bootstrap
	zip -r -j out/GoProductCreatedPricingHandler/GoProductCreatedPricingHandler.zip out/GoProductCreatedPricingHandler/bootstrap

package-ProductApiPricingWorker:
	cd src/product-api;go mod tidy;GOOS=linux GOARCH=arm64 go build -o bootstrap handle-pricing-changed/main.go;cp bootstrap ../../out/PriceCalculatedHandlerFunction/bootstrap
	zip -r -j out/PriceCalculatedHandlerFunction/PriceCalculatedHandlerFunction.zip out/PriceCalculatedHandlerFunction/bootstrap

package-ProductPublicEventPublisher:
	cd src/product-event-publisher;go mod tidy;GOOS=linux GOARCH=arm64 go build -o bootstrap public-event-publisher/main.go;cp bootstrap ../../out/GoProductPublicEventPublisher/bootstrap
	zip -r -j out/GoProductPublicEventPublisher/GoProductPublicEventPublisher.zip out/GoProductPublicEventPublisher/bootstrap

package-InventoryProductCreatedHandler:
	cd src/inventory-acl;go mod tidy;GOOS=linux GOARCH=arm64 go build -o bootstrap product-created-public-event-handler/main.go;cp bootstrap ../../out/GoInventoryAcl/bootstrap
	zip -r -j out/GoInventoryAcl/GoInventoryAcl.zip out/GoInventoryAcl/bootstrap

package-InventoryOrderingWorkflow:
	cd src/inventory-ordering-service;go mod tidy;GOOS=linux GOARCH=arm64 go build -o bootstrap handle-product-added/main.go;cp bootstrap ../../out/GoInventoryOrderingService/bootstrap
	zip -r -j out/GoInventoryOrderingService/GoInventoryOrderingService.zip out/GoInventoryOrderingService/bootstrap

package-GoAnalyticsBackend:
	cd src/analytics-service;go mod tidy;GOOS=linux GOARCH=arm64 go build -o bootstrap handle-events/main.go;cp bootstrap ../../out/GoAnalyticsBackend/bootstrap
	zip -r -j out/GoAnalyticsBackend/GoAnalyticsBackend.zip out/GoAnalyticsBackend/bootstrap


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

build-ProductUpdatedPricingServiceFunction:
	cd src/product-pricing-service;go mod tidy;GOOS=linux GOARCH=arm64 go build -o bootstrap handle-product-updated/main.go;cp bootstrap $(ARTIFACTS_DIR)/bootstrap

build-ProductCreatedPricingServiceFunction:
	cd src/product-pricing-service;go mod tidy;GOOS=linux GOARCH=arm64 go build -o bootstrap handle-product-created/main.go;cp bootstrap $(ARTIFACTS_DIR)/bootstrap

build-ProductApiPricingWorker:
	cd src/product-api;go mod tidy;GOOS=linux GOARCH=arm64 go build -o bootstrap handle-pricing-changed/main.go;cp bootstrap $(ARTIFACTS_DIR)/bootstrap

build-ProductPublicEventPublisher:
	cd src/product-event-publisher;go mod tidy;GOOS=linux GOARCH=arm64 go build -o bootstrap public-event-publisher/main.go;cp bootstrap $(ARTIFACTS_DIR)/bootstrap

build-InventoryProductCreatedHandler:
	cd src/inventory-acl;go mod tidy;GOOS=linux GOARCH=arm64 go build -o bootstrap product-created-public-event-handler/main.go;cp bootstrap $(ARTIFACTS_DIR)/bootstrap

build-InventoryOrderingWorkflow:
	cd src/inventory-ordering-service;go mod tidy;GOOS=linux GOARCH=arm64 go build -o bootstrap handle-product-added/main.go;cp bootstrap $(ARTIFACTS_DIR)/bootstrap

build-GoAnalyticsBackend:
	cd src/analytics-service;go mod tidy;GOOS=linux GOARCH=arm64 go build -o bootstrap handle-events/main.go;cp bootstrap $(ARTIFACTS_DIR)/bootstrap

