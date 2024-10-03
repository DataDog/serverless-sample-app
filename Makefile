load:
	cd loadtest; artillery run loadtest.yml; cd ..

package-dotnet:
	dotnet lambda package -pl src/dotnet/src/Analytics/Analytics.Adapters/
	dotnet lambda package -pl src/dotnet/src/Product.Api/ProductApi.Adapters/
	dotnet lambda package -pl src/dotnet/src/Inventory.Acl/Inventory.Acl.Adapters/
	dotnet lambda package -pl src/dotnet/src/Inventory.Ordering/Inventory.Ordering.Adapters/
	dotnet lambda package -pl src/dotnet/src/Product.EventPublisher/ProductEventPublisher.Adapters/
	dotnet lambda package -pl src/dotnet/src/Product.Pricing/ProductPricingService.Lambda/

test-dotnet:
	dotnet test src/dotnet/src/Product.Api/ProductApi.Core.Test/ProductApi.Core.Test.csproj
	dotnet test src/dotnet/src/Product.Pricing/ProductPricingService.Core.Test/ProductPricingService.Core.Test.csproj
	dotnet test src/dotnet/src/Product.EventPublisher/ProductEventPublisher.Core.Tests/ProductEventPublisher.Core.Tests.csproj
	dotnet test src/dotnet/src/Inventory.Ordering/Inventory.Ordering.Core.Test/Inventory.Ordering.Core.Test.csproj
	dotnet test src/dotnet/src/Inventory.Acl/Inventory.Acl.Core.Test/Inventory.Acl.Core.Test.csproj

cdk-rust:
	cd src/rust; npm i; cdk deploy --require-approval never --all --concurrency 3

cdk-nodejs:
	cd src/nodejs; npm i; cdk deploy --require-approval never --all --concurrency 3

end-to-end-test-nodejs:
	cd src/nodejs; npm i; npm run test -- product-service

cdk-dotnet:
	cd src/dotnet/cdk; dotnet tool install -g Amazon.Lambda.Tools; cdk deploy --require-approval never --all --concurrency 3

cdk-java:
	cd src/java;mvn clean package;cd cdk;cdk deploy --all --require-approval never --concurrency 3

cdk-go:
	cd src/go/cdk; cdk deploy --require-approval never --all --concurrency 3

cdk-dotnet-dev:
	cd src/dotnet/cdk; cdk deploy --require-approval never --all --hotswap-fallback --concurrency 3

cdk-dotnet-destroy:
	cd src/dotnet/cdk; cdk destroy --all --require-approval never

sam-dotnet:
	cd src/dotnet; sam build;sam deploy --stack-name DotnetTracing --parameter-overrides "ParameterKey=DDApiKeySecretArn,ParameterValue=${DD_SECRET_ARN}" "ParameterKey=DDSite,ParameterValue=${DD_SITE}" --resolve-s3 --capabilities CAPABILITY_IAM CAPABILITY_AUTO_EXPAND --region ${AWS_REGION}

sam-dotnet-destroy:
	cd src/dotnet; sam delete --stack-name DotnetTracing --region ${AWS_REGION} --no-prompts

tf-dotnet: package-dotnet tf-dotnet-deploy
	
tf-dotnet-deploy:
	cd src/dotnet/infra; terraform apply --var-file dev.tfvars

tf-dotnet-destroy:
	cd src/dotnet/infra; terraform destroy --var-file dev.tfvars

cdk-rust-dev:
	cd src/rust; npm i; cdk deploy --require-approval never --all --hotswap-fallback --concurrency 3

cdk-rust-destroy:
	cd src/rust; cdk destroy --all --require-approval never

package-java:
	mvn clean package -f src/java/pom.xml