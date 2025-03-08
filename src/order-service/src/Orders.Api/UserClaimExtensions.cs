// Unless explicitly stated otherwise all files in this repository are licensed under the Apache License Version 2.0.
// This product includes software developed at Datadog (https://www.datadoghq.com/).
// Copyright 2025 Datadog, Inc.

using System.Diagnostics;
using System.Security.Claims;
using Datadog.Trace;

namespace Orders.Api;

public record UserClaims(string UserId, string UserType);

public static class UserClaimExtensions
{
    public static UserClaims ExtractUserId(this IEnumerable<Claim> claims)
    {
        var userId = claims.FirstOrDefault(c => c.Type == "http://schemas.xmlsoap.org/ws/2005/05/identity/claims/nameidentifier").Value;
        var userType = claims.FirstOrDefault(c => c.Type == "user_type").Value;

        if (Tracer.Instance.ActiveScope != null)
        {
            Tracer.Instance.ActiveScope.Span.SetTag("user.id", userId);
            Tracer.Instance.ActiveScope.Span.SetTag("user.type", userType);
        }
        
        return new UserClaims(userId, userType);
    }
}