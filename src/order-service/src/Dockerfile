FROM mcr.microsoft.com/dotnet/aspnet:9.0 AS base
WORKDIR /app

FROM mcr.microsoft.com/dotnet/sdk:9.0 AS build

# Download the latest version of the tracer but don't install yet
RUN curl -Lo /tmp/datadog-dotnet-apm.deb https://github.com/DataDog/dd-trace-dotnet/releases/download/v3.20.0/datadog-dotnet-apm_3.20.0_amd64.deb

WORKDIR /src

# Copy csproj and restore as distinct layers
COPY ["Orders.Api/Orders.Api.csproj", "./Orders.Api/"]
COPY ["Orders.Core/Orders.Core.csproj", "./Orders.Core/"]
RUN dotnet restore "Orders.Api/Orders.Api.csproj"
COPY . .
RUN dotnet build "Orders.Api/Orders.Api.csproj" -c Release -o /app/build

FROM build AS publish
RUN dotnet publish "Orders.Api/Orders.Api.csproj" -c Release -o /app/publish

FROM base AS final

# Copy the tracer from build target
COPY --from=build /tmp/datadog-dotnet-apm.deb /tmp/datadog-dotnet-apm.deb
# Install the tracer
RUN mkdir -p /opt/datadog \
    && mkdir -p /var/log/datadog \
    && dpkg -i /tmp/datadog-dotnet-apm.deb \
    && rm /tmp/datadog-dotnet-apm.deb

WORKDIR /app
COPY --from=publish /app/publish .

# Enable Datadog automatic instrumentation
# App is being copied to /app, so Datadog assets are at /app/datadog
ENV CORECLR_ENABLE_PROFILING=1
ENV CORECLR_PROFILER={846F5F1C-F9AE-4B07-969E-05C26BC060D8}
ENV CORECLR_PROFILER_PATH=/opt/datadog/Datadog.Trace.ClrProfiler.Native.so
ENV DD_DOTNET_TRACER_HOME=/opt/datadog
ENV DD_INTEGRATIONS=/opt/datadog/integrations.json
ENV DD_LOGS_INJECTION=true
ENV DD_RUNTIME_METRICS_ENABLED=true

ENTRYPOINT ["dotnet", "Orders.Api.dll"]