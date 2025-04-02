cdk-deploy-local:
	docker run -it \
		-v "$(pwd):/serverless-sample-app" \
		-w "/serverless-sample-app" \
		-e AWS_ACCESS_KEY_ID="${AWS_ACCESS_KEY_ID}" \
		-e AWS_SECRET_ACCESS_KEY="${AWS_SECRET_ACCESS_KEY}" \
		-e AWS_SESSION_TOKEN="${AWS_SESSION_TOKEN}" \
		-e AWS_REGION="${AWS_REGION}" \
		-e ENV=dev \
		-e DD_API_KEY="${DD_API_KEY}" \
		-e DD_SITE="${DD_SITE}" \
		public.ecr.aws/k4y9x2e7/dd-serverless-sample-app-build-image:latest