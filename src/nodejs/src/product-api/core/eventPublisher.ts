//
// Unless explicitly stated otherwise all files in this repository are licensed
// under the Apache License Version 2.0.
// This product includes software developed at Datadog (https://www.datadoghq.com/).
// Copyright 2024 Datadog, Inc.
//

import { ProductCreatedEvent } from "../private-events/productCreatedEvent";
import { ProductDeletedEvent } from "../private-events/productDeletedEvent";
import { ProductUpdatedEvent } from "../private-events/productUpdatedEvent";

export interface EventPublisher {
  publishProductCreatedEvent(evt: ProductCreatedEvent): Promise<boolean>;
  publishProductUpdatedEvent(evt: ProductUpdatedEvent): Promise<boolean>;
  publishProductDeletedEvent(evt: ProductDeletedEvent): Promise<boolean>;
}
