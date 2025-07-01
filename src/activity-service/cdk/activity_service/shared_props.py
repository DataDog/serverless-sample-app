from datadog_cdk_constructs_v2 import DatadogLambda


class SharedProps:
    def __init__(self, team: str, domain: str, service_name: str, environment: str, version: str, datadog_configuration: DatadogLambda) -> None:
        self.team = team
        self.domain = domain
        self.service_name = service_name
        self.environment = environment
        self.version = version
        self.datadog_configuration = datadog_configuration
