FROM public.ecr.aws/lambda/dotnet:8 AS base

FROM mcr.microsoft.com/dotnet/sdk:8.0 as build
WORKDIR /src
COPY [".", "."]
RUN dotnet restore "./ProductApi.Adapters/ProductApi.Adapters.csproj"

FROM build AS publish
RUN dotnet publish "./ProductApi.Adapters/ProductApi.Adapters.csproj" \
            --configuration Release \ 
            --runtime linux-x64 \
            --self-contained false \ 
            --output /app/publish \
            -p:PublishReadyToRun=true  

FROM base AS final
WORKDIR /var/task

# Copy in Lambdad extension
COPY --from=public.ecr.aws/datadog/lambda-extension:67 /opt/. /opt/

# Install Datadog tracer
RUN dnf -y install tar wget gzip
RUN wget https://github.com/DataDog/dd-trace-dotnet/releases/download/v3.6.1/datadog-dotnet-apm-3.6.1.tar.gz
RUN mkdir /opt/datadog
RUN tar -C /opt/datadog -xzf datadog-dotnet-apm-3.6.1.tar.gz

# Set Lambda Handler wrapper
ENV AWS_LAMBDA_EXEC_WRAPPER /opt/datadog_wrapper

COPY --from=publish /app/publish .  

# Set main handler
CMD [ "ProductApi.Adapters::ProductApi.Adapters.ApiFunctions_GetProduct_Generated::GetProduct" ]