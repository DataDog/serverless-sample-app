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

export class PricingServiceProps {
  private sharedEventBus: IEventBus | undefined;
  private pricingEventBus: IEventBus;
  private jwtSecretAccessKey: IStringParameter;
  private sharedProps: SharedProps;

  constructor(scope: Construct, sharedProps: SharedProps) {
    var integratedEnvironments = ["dev", "prod"];
    this.sharedProps = sharedProps;

    this.pricingEventBus = new EventBus(scope, "PricingEventBus", {
      eventBusName: `${sharedProps.serviceName}-bus-${sharedProps.environment}`,
    });

    var pricingEventBusArnParameter = new StringParameter(
      scope,
      "PricingEventBusArnParameter",
      {
        parameterName: `/${sharedProps.environment}/${sharedProps.serviceName}/event-bus-arn`,
        stringValue: this.pricingEventBus.eventBusArn,
      }
    );
    var pricingEventBusNameParameter = new StringParameter(
      scope,
      "PricingEventBusNameParameter",
      {
        parameterName: `/${sharedProps.environment}/${sharedProps.serviceName}/event-bus-name`,
        stringValue: this.pricingEventBus.eventBusName,
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
    return this.sharedEventBus ?? this.pricingEventBus;
  }

  getSubscriberBus(): IEventBus {
    return this.pricingEventBus;
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
        eventBus: this.pricingEventBus,
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
      sharedBusRule.addTarget(new EventBusTarget(this.pricingEventBus));
    }

    return rule;
  }
}
