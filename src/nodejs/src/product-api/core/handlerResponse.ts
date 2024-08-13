//
// Unless explicitly stated otherwise all files in this repository are licensed
// under the Apache License Version 2.0.
// This product includes software developed at Datadog (https://www.datadoghq.com/).
// Copyright 2024 Datadog, Inc.
//

export class HandlerResponse<T> {
  data: T | undefined;
  message: string[];
  success: boolean;
}
