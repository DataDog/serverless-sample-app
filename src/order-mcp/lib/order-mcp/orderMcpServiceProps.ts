import {
  EventBus,
  EventPattern,
  IEventBus,
  IRule,
  Rule,
} from "aws-cdk-lib/aws-events";
import { SharedProps } from "../constructs/sharedFunctionProps";
import { IStringParameter, StringParameter } from "aws-cdk-lib/aws-ssm";
import { Construct } from "constructs";
import { EventBus as EventBusTarget } from "aws-cdk-lib/aws-events-targets";

export class OrderMcpServiceProps {
  private sharedEventBus: IEventBus | undefined;
  private orderMcpEventBus: IEventBus;
  private jwtSecretAccessKey: IStringParameter;
  private sharedProps: SharedProps;

  constructor(scope: Construct, sharedProps: SharedProps) {
    var integratedEnvironments = ["dev", "prod"];
    this.sharedProps = sharedProps;

    this.orderMcpEventBus = new EventBus(scope, "OrderMcpEventBus", {
      eventBusName: `${sharedProps.serviceName}-bus-${sharedProps.environment}`,
    });

    var orderMcpEventBusArnParameter = new StringParameter(
      scope,
      "OrderMcpEventBusArnParameter",
      {
        parameterName: `/${sharedProps.environment}/${sharedProps.serviceName}/event-bus-arn`,
        stringValue: this.orderMcpEventBus.eventBusArn,
      }
    );
    var orderMcpEventBusNameParameter = new StringParameter(
      scope,
      "OrderMcpEventBusNameParameter",
      {
        parameterName: `/${sharedProps.environment}/${sharedProps.serviceName}/event-bus-name`,
        stringValue: this.orderMcpEventBus.eventBusName,
      }
    );

    if (!integratedEnvironments.includes(sharedProps.environment)) {
      this.jwtSecretAccessKey = new StringParameter(
        scope,
        "JwtSecretAccessKey",
        {
          parameterName: `/${sharedProps.environment}/${sharedProps.serviceName}/secret-access-key`,
          stringValue:
            "This is a sample secret key that should not be used in production`",
        }
      );
    } else {
      this.jwtSecretAccessKey = StringParameter.fromStringParameterName(
        scope,
        "SecretAccessKeyParameter",
        `/${sharedProps.environment}/shared/secret-access-key`
      );

      const sharedEventBusParam = StringParameter.fromStringParameterName(
        scope,
        "EventBusParameter",
        `/${sharedProps.environment}/shared/event-bus-name`
      );

      this.sharedEventBus = EventBus.fromEventBusName(
        scope,
        "SharedEventBus",
        sharedEventBusParam.stringValue
      );
    }
  }

  getPublisherBus(): IEventBus {
    return this.sharedEventBus ?? this.orderMcpEventBus;
  }

  getSubscriberBus(): IEventBus {
    return this.orderMcpEventBus;
  }

  getJwtSecret(): IStringParameter {
    return this.jwtSecretAccessKey;
  }

  getSharedProps(): SharedProps {
    return this.sharedProps;
  }

  addSubscriptionRule(
    scope: Construct,
    ruleName: string,
    eventPattern: EventPattern
  ): Rule {
    // Create the rule on the domain bus.
    const rule = new Rule(
      scope,
      `${this.sharedProps.serviceName}-${ruleName}-${this.sharedProps.environment}`,
      {
        eventBus: this.orderMcpEventBus,
      }
    );
    rule.addEventPattern(eventPattern);

    // If the shared event bus is defined, add the rule to it as well.
    if (this.sharedEventBus !== undefined) {
      const sharedBusRule = new Rule(
        scope,
        `${this.sharedProps.serviceName}-Shared${ruleName}-${this.sharedProps.environment}`,
        {
          eventBus: this.sharedEventBus,
        }
      );
      sharedBusRule.addEventPattern(eventPattern);
      sharedBusRule.addTarget(new EventBusTarget(this.orderMcpEventBus));
    }

    return rule;
  }
}
