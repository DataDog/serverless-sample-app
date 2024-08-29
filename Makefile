test-dotnet:
	dotnet test src/dotnet/src/Product.Api/Product.Api.Core.Test/Product.Api.Core.Test.csproj

package-java:
	cd src/java/
    mvn clean package