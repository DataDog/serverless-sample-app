//
// Unless explicitly stated otherwise all files in this repository are licensed
// under the Apache License Version 2.0.
// This product includes software developed at Datadog (https://www.datadoghq.com/).
// Copyright 2024 Datadog, Inc.
//

import { DatadogLambda } from "datadog-cdk-constructs-v2";

export interface SharedProps {
  team: string;
  domain: string;
  serviceName: string;
  environment: string;
  version: string;
  datadogConfiguration: DatadogLambda;
}
