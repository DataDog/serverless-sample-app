.PHONY: install build cdk-deploy cdk-destroy lint unit-test format sam sam-destroy
PYTHON := ".venv/bin/python3"
.ONESHELL:

dev:
	poetry env use python3.13
	pip install --upgrade pip poetry
	pip install poetry-plugin-export
	poetry config --local virtualenvs.in-project true
	poetry install --no-root
	poetry self add poetry-plugin-export
	npm ci

deps:
	poetry export --only=dev --format=requirements.txt > dev_requirements.txt
	poetry export --without=dev --format=requirements.txt > lambda_requirements.txt

build: deps
	rm -rf .build
	mkdir -p .build/lambdas ; cp -r product_search_service .build/lambdas
	mkdir -p .build/common_layer ; poetry export --without=dev --format=requirements.txt > .build/common_layer/requirements.txt

cdk-deploy: build
	cdk deploy --require-approval never --all

cdk-destroy:
	cdk destroy --all --force

lint:
	poetry run ruff check . && poetry run mypy .

unit-test:
	poetry run pytest tests/unit -v

integration-test:
	poetry run pytest tests/integration -v --timeout=180

format:
	poetry run ruff format .

sam: build
	sam build
	sam deploy --stack-name ProductSearchService-${ENV} \
		--parameter-overrides \
			ParameterKey=DDApiKey,ParameterValue=${DD_API_KEY} \
			ParameterKey=DDSite,ParameterValue=${DD_SITE} \
			ParameterKey=Env,ParameterValue=${ENV} \
			ParameterKey=CommitHash,ParameterValue=${COMMIT_HASH} \
		--no-confirm-changeset --no-fail-on-empty-changeset \
		--capabilities CAPABILITY_IAM CAPABILITY_AUTO_EXPAND \
		--resolve-s3 --region ${AWS_REGION} \
		--tags DD_PRESERVE_STACK=true

sam-destroy:
	sam delete --stack-name ProductSearchService-${ENV} --region ${AWS_REGION} --no-prompts

build-terraform: build
	@echo "Creating ZIP file for Terraform deployment"
	cd .build/lambdas && zip -r ../product_search_service.zip .

tf-apply: build-terraform
	cd infra && terraform init && terraform apply --var-file dev.tfvars --auto-approve

tf-apply-local: build-terraform
	cd infra && terraform init && terraform apply --var-file dev.tfvars --auto-approve

tf-destroy:
	cd infra && terraform destroy --var-file dev.tfvars --auto-approve
