//
// Unless explicitly stated otherwise all files in this repository are licensed
// under the Apache License Version 2.0.
// This product includes software developed at Datadog (https://www.datadoghq.com/).
// Copyright 2024 Datadog, Inc.
//

import { StockLevelUpdatedEvent } from "../private-events/stockLevelUpdatedEvent";

export interface PrivateEventPublisher {
  publish(evt: StockLevelUpdatedEvent): Promise<boolean>;
}
