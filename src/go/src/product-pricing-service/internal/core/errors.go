//
// Unless explicitly stated otherwise all files in this repository are licensed
// under the Apache License Version 2.0.
// This product includes software developed at Datadog (https://www.datadoghq.com/).
// Copyright 2024 Datadog, Inc.
//

package core

type PriceLessThanZeroError struct{ Detail string }

func (e *PriceLessThanZeroError) Error() string {
	return "Input price is less than 0"
}

type MissingProductIdError struct{ Detail string }

func (e *MissingProductIdError) Error() string {
	return "Event is missing a productId"
}
