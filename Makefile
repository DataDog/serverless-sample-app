load:
	cd loadtest; artillery run loadtest.yml; cd ..

package-dotnet:
	dotnet publish src/dotnet/ -r linux-x64

test-dotnet:
	dotnet test src/dotnet/src/Product.Api/ProductApi.Core.Test/ProductApi.Core.Test.csproj
	dotnet test src/dotnet/src/Product.Pricing/ProductPricingService.Core.Test/ProductPricingService.Core.Test.csproj
	dotnet test src/dotnet/src/Product.EventPublisher/ProductEventPublisher.Core.Tests/ProductEventPublisher.Core.Tests.csproj
	dotnet test src/dotnet/src/Inventory.Ordering/Inventory.Ordering.Core.Test/Inventory.Ordering.Core.Test.csproj
	dotnet test src/dotnet/src/Inventory.Acl/Inventory.Acl.Core.Test/Inventory.Acl.Core.Test.csproj

cdk-dotnet:
	cd src/dotnet/cdk; cdk deploy --require-approval never --all

cdk-dotnet-dev:
	cd src/dotnet/cdk; cdk deploy --require-approval never --all --hotswap-fallback --concurrency 3

cdk-dotnet-destroy:
	cd src/dotnet/cdk; cdk destroy --all --require-approval never

package-java:
	mvn clean package -f src/java/pom.xml