package-dotnet:
	dotnet publish src/dotnet/ -r linux-x64

test-dotnet:
	dotnet test src/dotnet/src/Product.Api/Product.Api.Core.Test/Product.Api.Core.Test.csproj

package-java:
	mvn clean package -f src/java/pom.xml