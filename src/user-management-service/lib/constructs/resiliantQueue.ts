//
// Unless explicitly stated otherwise all files in this repository are licensed
// under the Apache License Version 2.0.
// This product includes software developed at Datadog (https://www.datadoghq.com/).
// Copyright 2024 Datadog, Inc.
//

import { Construct } from "constructs";
import { Tags } from "aws-cdk-lib";
import { SharedProps } from "./sharedFunctionProps";
import { Queue } from "aws-cdk-lib/aws-sqs";

export interface QueueProps {
  sharedProps: SharedProps
  queueName: string
}

export class ResiliantQueue extends Construct {
  queue: Queue;
  deadLetterQueue: Queue

  constructor(scope: Construct, id: string, props: QueueProps) {
    super(scope, id);

    this.deadLetterQueue = new Queue(this, `${props.queueName}DLQ-${props.sharedProps.environment}`, {
        queueName: `${props.queueName}DLQ-${props.sharedProps.environment}`
    });

    this.queue = new Queue(this, `${props.queueName}-${props.sharedProps.environment}`, {
        queueName: `${props.queueName}-${props.sharedProps.environment}`,
        deadLetterQueue: {
            maxReceiveCount: 3,
            queue: this.deadLetterQueue
        }
    });

    Tags.of(this.deadLetterQueue).add("service", props.sharedProps.serviceName);
    Tags.of(this.deadLetterQueue).add("env", props.sharedProps.environment);
    Tags.of(this.deadLetterQueue).add("version", props.sharedProps.version);
    Tags.of(this.queue).add("service", props.sharedProps.serviceName);
    Tags.of(this.queue).add("env", props.sharedProps.environment);
    Tags.of(this.queue).add("version", props.sharedProps.version);
  }
}
