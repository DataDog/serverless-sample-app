from aws_cdk import aws_events as events
from aws_cdk import aws_ssm as ssm
from constructs import Construct

from cdk.activity_service.shared_props import SharedProps


class SharedResources:
    def __init__(self, scope: Construct, shared_props: SharedProps):
        integrated_environments = ["dev", "prod"]
        self.shared_props = shared_props

        self.activity_event_bus = events.EventBus(
            scope,
            "ActivityEventBus",
            event_bus_name=f"{shared_props.service_name}-events-{shared_props.environment}",
        )

        self.Activity_event_bus_arn_param = ssm.StringParameter(
            scope,
            "ActivityEventBusArnParameter",
            parameter_name=f"/{shared_props.environment}/{shared_props.service_name}/event-bus-arn",
            string_value=self.activity_event_bus.event_bus_arn,
        )
        self.Activity_event_bus_name_param = ssm.StringParameter(
            scope,
            "ActivityEventBusNameParameter",
            parameter_name=f"/{shared_props.environment}/{shared_props.service_name}/event-bus-name",
            string_value=self.activity_event_bus.event_bus_name,
        )

        self.shared_event_bus = None
        if shared_props.environment not in integrated_environments:
            self.jwt_secret_access_key = ssm.StringParameter(
                scope,
                "JwtSecretAccessKey",
                parameter_name=f"/{shared_props.environment}/{shared_props.service_name}/secret-access-key",
                string_value="This is a sample secret key that should not be used in production`",
            )
        else:
            self.jwt_secret_access_key = ssm.StringParameter.from_string_parameter_name(
                scope,
                "SecretAccessKeyParameter",
                f"/{shared_props.environment}/shared/secret-access-key",
            )
            shared_event_bus_param = ssm.StringParameter.from_string_parameter_name(
                scope,
                "EventBusParameter",
                f"/{shared_props.environment}/shared/event-bus-name",
            )
            self.shared_event_bus = events.EventBus.from_event_bus_name(
                scope,
                "SharedEventBus",
                shared_event_bus_param.string_value,
            )

    def get_publisher_bus(self):
        return self.shared_event_bus or self.activity_event_bus

    def get_subscriber_bus(self):
        return self.activity_event_bus

    def get_jwt_secret(self):
        return self.jwt_secret_access_key

    def get_shared_props(self):
        return self.shared_props

    def add_subscription_rule(self, scope: Construct, rule_name: str, detail_type: str):
        # Create event pattern using the provided detail_type
        event_pattern = events.EventPattern(
            detail_type=[detail_type]  # EventPattern expects a list of strings
        )

        rule = events.Rule(
            scope,
            rule_name,
            rule_name=rule_name,
            event_bus=self.activity_event_bus,
            event_pattern=event_pattern,
        )

        if self.shared_event_bus is not None:
            shared_bus_rule = events.Rule(
                scope,
                f"Shared{rule_name}",
                rule_name=f"Shared{rule_name}",
                description=f"{self.shared_props.service_name} subscribing to {detail_type} in the '{self.shared_props.environment}' environment",
                event_bus=self.shared_event_bus,
                event_pattern=event_pattern,
            )
            # Add the Activity event bus as a target to the shared bus rule
            from aws_cdk.aws_events_targets import EventBus as EventBusTarget
            shared_bus_rule.add_target(EventBusTarget(self.activity_event_bus))

        return rule
