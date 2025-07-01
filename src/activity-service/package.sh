poetry export --only=dev --format=requirements.txt > dev_requirements.txt
poetry export --without=dev --format=requirements.txt > lambda_requirements.txt
mkdir -p .build/lambdas ; cp -r activity_service .build/lambdas
mkdir -p .build/common_layer ; poetry export --without=dev --format=requirements.txt > .build/common_layer/requirements.txt
