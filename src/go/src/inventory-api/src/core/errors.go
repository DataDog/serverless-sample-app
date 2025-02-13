//
// Unless explicitly stated otherwise all files in this repository are licensed
// under the Apache License Version 2.0.
// This product includes software developed at Datadog (https://www.datadoghq.com/).
// Copyright 2024 Datadog, Inc.
//

package core

import "fmt"

type UnknownError struct{ Detail string }

func (e *UnknownError) Error() string {
	return fmt.Sprintf("Unknown error: %s", e.Detail)
}

type ProductNotFoundError struct {
	ProductId string
}

func (e *ProductNotFoundError) Error() string {
	return "Product not found"
}
