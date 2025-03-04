// Unless explicitly stated otherwise all files in this repository are licensed under the Apache License Version 2.0.
// This product includes software developed at Datadog (https://www.datadoghq.com/).
// Copyright 2025 Datadog, Inc.

using Amazon.Lambda.Annotations;
using Orders.Core;
using Orders.Core.StockReservationFailure;
using Orders.Core.StockReservationSuccess;

namespace Orders.BackgroundWorkers;

public class WorkflowHandlers(StockReservationSuccessHandler successHandler, StockReservationFailureHandler failureHandler)
{
    [LambdaFunction]
    public async Task ReservationSuccess(StockReservationSuccess request)
    {
        await successHandler.Handle(request);
    }
    
    [LambdaFunction]
    public async Task ReservationFailed(StockReservationFailure request)
    {
        await failureHandler.Handle(request);
    }
}