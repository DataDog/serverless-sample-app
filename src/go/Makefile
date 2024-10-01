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

