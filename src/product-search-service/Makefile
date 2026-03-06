.PHONY: install build cdk-deploy cdk-destroy lint unit-test format sam sam-destroy
PYTHON := ".venv/bin/python3"
.ONESHELL:

install:
	pip install --upgrade pip poetry
	poetry config --local virtualenvs.in-project true
	poetry install --no-root

build:
	rm -rf .build
	mkdir -p .build/lambdas
	cp -r product_search_service .build/lambdas/
	pip install \
		"aws-lambda-powertools[tracer]>=3.0.0" \
		"pydantic>=2.0.0" \
		"boto3>=1.37.0" \
		"ddtrace>=3.0.0" \
		"requests>=2.32.0" \
		-t .build/lambdas/ \
		--platform manylinux2014_aarch64 \
		--implementation cp \
		--python-version 313 \
		--only-binary=:all: \
		--upgrade \
		--quiet

cdk-deploy: build
	cd cdk && pip install -r requirements.txt && cdk deploy --app "python3 app.py" --all --require-approval never

cdk-destroy:
	cd cdk && cdk destroy --app "python3 app.py" --all

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
			ParameterKey=DDApiKeySecretArn,ParameterValue=${DD_API_KEY_SECRET_ARN} \
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
