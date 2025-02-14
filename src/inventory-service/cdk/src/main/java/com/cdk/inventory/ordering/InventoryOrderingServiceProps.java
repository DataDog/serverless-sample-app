/*
 * Unless explicitly stated otherwise all files in this repository are licensed under the Apache License Version 2.0.
 * This product includes software developed at Datadog (https://www.datadoghq.com/).
 * Copyright 2024 Datadog, Inc.
 */

package com.cdk.inventory.ordering;

import com.cdk.constructs.SharedProps;
import software.amazon.awscdk.services.dynamodb.ITable;
import software.amazon.awscdk.services.sns.ITopic;

public record InventoryOrderingServiceProps(SharedProps sharedProps, ITable table, ITopic newProductAddedTopic) {
}
