package-dotnet:
	dotnet publish src/dotnet/ -r linux-x64

test-dotnet:
	dotnet test src/dotnet/src/Product.Api/ProductService.Api.Core.Test/ProductService.Api.Core.Test.csproj
	dotnet test src/dotnet/src/Product.Pricing/ProductPricingService.Core.Test/ProductPricingService.Core.Test.csproj

cdk-dotnet:
	cd src/dotnet/cdk; cdk deploy --require-approval never --all

cdk-dotnet-dev:
	cd src/dotnet/cdk; cdk deploy --require-approval never --all --hotswap-fallback --concurrency 3

cdk-dotnet-destroy:
	cd src/dotnet/cdk; cdk destroy --all --require-approval never

package-java:
	mvn clean package -f src/java/pom.xml