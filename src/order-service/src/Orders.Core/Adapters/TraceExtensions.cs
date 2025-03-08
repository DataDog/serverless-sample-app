// Unless explicitly stated otherwise all files in this repository are licensed under the Apache License Version 2.0.
// This product includes software developed at Datadog (https://www.datadoghq.com/).
// Copyright 2025 Datadog, Inc.

using System.Diagnostics;
using Amazon.DynamoDBv2.Model;
using Amazon.StepFunctions.Model;
using Datadog.Trace;

namespace Orders.Core.Adapters;

public static class TraceExtensions
{
    public static void AddToTelemetry(this QueryResponse queryResponse)
    {
        if (Tracer.Instance.ActiveScope == null || queryResponse.ConsumedCapacity == null)
        {
            return;
        }
        
        Tracer.Instance.ActiveScope.Span.SetTag("db.wcu", queryResponse.ConsumedCapacity.WriteCapacityUnits);
        Tracer.Instance.ActiveScope.Span.SetTag("db.rcu", queryResponse.ConsumedCapacity.ReadCapacityUnits);
        Tracer.Instance.ActiveScope.Span.SetTag("db.scannedCount", queryResponse.ScannedCount);
        Tracer.Instance.ActiveScope.Span.SetTag("db.count", queryResponse.Count);
    }
    public static void AddToTelemetry(this GetItemResponse queryResponse)
    {
        if (Tracer.Instance.ActiveScope == null || queryResponse.ConsumedCapacity == null)
        {
            return;
        }
        
        Tracer.Instance.ActiveScope.Span.SetTag("db.wcu", queryResponse.ConsumedCapacity.WriteCapacityUnits);
        Tracer.Instance.ActiveScope.Span.SetTag("db.rcu", queryResponse.ConsumedCapacity.ReadCapacityUnits);
        Tracer.Instance.ActiveScope.Span.SetTag("db.itemFound", queryResponse.IsItemSet.ToString());
    }
    public static void AddToTelemetry(this PutItemResponse queryResponse)
    {
        if (Tracer.Instance.ActiveScope == null || queryResponse.ConsumedCapacity == null)
        {
            return;
        }
        
        Tracer.Instance.ActiveScope.Span.SetTag("db.wcu", queryResponse.ConsumedCapacity.WriteCapacityUnits);
        Tracer.Instance.ActiveScope.Span.SetTag("db.rcu", queryResponse.ConsumedCapacity.ReadCapacityUnits);
    }
    
    public static void AddToTelemetry(this StartExecutionRequest queryResponse)
    {
        if (Tracer.Instance.ActiveScope == null)
        {
            return;
        }
        
        Tracer.Instance.ActiveScope.Span.SetTag("workflow.arn", queryResponse.StateMachineArn);
        Tracer.Instance.ActiveScope.Span.SetTag("workflow.name", queryResponse.Name);
    }
    
    public static void AddToTelemetry(this StartExecutionResponse queryResponse)
    {
        if (Tracer.Instance.ActiveScope == null)
        {
            return;
        }
        
        Tracer.Instance.ActiveScope.Span.SetTag("workflow.executionArn", queryResponse.ExecutionArn);
    }
    
    public static void AddToTelemetry(this string value, string key)
    {
        if (Tracer.Instance.ActiveScope == null)
        {
            return;
        }
        
        Tracer.Instance.ActiveScope.Span.SetTag(key, value);
    }
}