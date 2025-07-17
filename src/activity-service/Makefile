.PHONY: dev lint mypy-lint complex coverage pre-commit sort deploy destroy deps unit infra-tests integration e2e coverage-tests docs lint-docs build build-terraform terraform-deploy terraform-destroy format format-fix compare-openapi openapi pr watch update-deps
PYTHON := ".venv/bin/python3"
.ONESHELL:  # run all commands in a single shell, ensuring it runs within a local virtual env

OPENAPI_DIR := ./docs/swagger
CURRENT_OPENAPI := $(OPENAPI_DIR)/openapi.json
LATEST_OPENAPI := openapi_latest.json


dev:
	pip install --upgrade pip pre-commit poetry
	pre-commit install
	poetry config --local virtualenvs.in-project true
	poetry install --no-root
	npm ci

format:
	poetry run ruff check . --fix

format-fix:
	poetry run ruff format .

lint: format
	@echo "Running mypy"
	$(MAKE) mypy-lint

complex:
	@echo "Running Radon"
	poetry run radon cc -e 'tests/*,cdk.out/*,node_modules/*' .
	@echo "Running xenon"
	poetry run xenon --max-absolute B --max-modules A --max-average A -e 'tests/*,.venv/*,cdk.out/*,node_modules/*' .

pre-commit:
	poetry run pre-commit run -a --show-diff-on-failure

mypy-lint:
	poetry run mypy --pretty activity_service cdk tests

deps:
	poetry export --only=dev --format=requirements.txt > dev_requirements.txt
	poetry export --without=dev --format=requirements.txt > lambda_requirements.txt

unit:
	poetry run pytest tests/unit  --cov-config=.coveragerc --cov=activity_service --cov-report xml

build: deps
	rm -rf .build
	mkdir -p .build/lambdas ; cp -r activity_service .build/lambdas
	mkdir -p .build/common_layer ; poetry export --without=dev --format=requirements.txt > .build/common_layer/requirements.txt

build-terraform: build
	@echo "Creating ZIP files for Terraform deployment"
	cd .build/lambdas && zip -r ../activity_service.zip .
	cd .build/common_layer && pip install --target python/lib/python3.13/site-packages -r requirements.txt && zip -r ../common_layer.zip python

integration-test:
	poetry run pytest tests/integration  --cov-config=.coveragerc --cov=activity_service --cov-report xml

pr: deps format pre-commit complex lint lint-docs unit deploy coverage-tests e2e openapi

coverage-tests:
	poetry run pytest tests/unit tests/integration  --cov-config=.coveragerc --cov=activity_service --cov-report xml

cdk-deploy: build
	npx cdk deploy --app="${PYTHON} ${PWD}/app.py" --require-approval=never

cdk-destroy:
	npx cdk destroy --app="${PYTHON} ${PWD}/app.py" --force

docs:
	poetry run mkdocs serve

lint-docs:
	docker run -v ${PWD}:/markdown 06kellyjac/markdownlint-cli --fix "docs"

watch:
	npx cdk watch

update-deps:
	poetry update
	pre-commit autoupdate
	npm i --package-lock-only

sam: build
	sam build;sam deploy --stack-name ActivityService-${ENV} --parameter-overrides ParameterKey=DDApiKey,ParameterValue=${DD_API_KEY} ParameterKey=DDSite,ParameterValue=${DD_SITE} ParameterKey=Env,ParameterValue=${ENV} ParameterKey=CommitHash,ParameterValue=${COMMIT_HASH} --no-confirm-changeset --no-fail-on-empty-changeset --capabilities CAPABILITY_NAMED_IAM CAPABILITY_AUTO_EXPAND --resolve-s3 --region ${AWS_REGION} --tags DD_PRESERVE_STACK=true

sam-destroy:
	sam delete --stack-name ActivityService-${ENV} --no-prompts

tf-apply: build-terraform
	cd infra;terraform init -backend-config="key=activity-service/${ENV}/terraform.tfstate" -backend-config "bucket=${TF_STATE_BUCKET_NAME}" -backend-config "region=${AWS_REGION}" -reconfigure;terraform apply -var dd_api_key=${DD_API_KEY} -var dd_site=${DD_SITE} -var env=${ENV} -var app_version=${COMMIT_HASH} -var region=${AWS_REGION} -auto-approve

tf-apply-local: build-terraform
	cd infra && \
	terraform init -backend=false -reconfigure && \
	terraform apply \
		-var dd_api_key=${DD_API_KEY} \
		-var dd_site=${DD_SITE} \
		-var env=${ENV} \
		-var app_version=${COMMIT_HASH} \
		-var region=${AWS_REGION} \
		-auto-approve

tf-destroy:
	cd infra;terraform init -backend-config="key=activity-service/${ENV}/terraform.tfstate" -backend-config "bucket=${TF_STATE_BUCKET_NAME}" -backend-config "region=${AWS_REGION}" -reconfigure;terraform destroy -var dd_api_key=${DD_API_KEY} -var dd_site=${DD_SITE} -var env=${ENV} -var app_version=${COMMIT_HASH} -var region=${AWS_REGION} -auto-approve

