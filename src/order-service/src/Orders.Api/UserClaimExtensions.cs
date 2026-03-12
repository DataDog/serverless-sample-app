// Unless explicitly stated otherwise all files in this repository are licensed under the Apache License Version 2.0.
// This product includes software developed at Datadog (https://www.datadoghq.com/).
// Copyright 2025 Datadog, Inc.

using System.Diagnostics;
using System.Security.Claims;
using Datadog.Trace;
using System.IdentityModel.Tokens.Jwt;

namespace Orders.Api;

public record UserClaims(string? UserId, string? UserType);

public static class UserClaimExtensions
{
    public static UserClaims? ExtractUserId(this IEnumerable<Claim>? claims)
    {
        if (claims is null)
        {
            return null;
        }

        var enumerable = claims.ToList();
        var userId = enumerable.FirstOrDefault(c =>
                c.Type == ClaimTypes.NameIdentifier ||
                c.Type == JwtRegisteredClaimNames.Sub ||
                c.Type == "sub")
            ?.Value;
        var userType = enumerable.FirstOrDefault(c => c.Type == "user_type")?.Value?.ToUpperInvariant();

        if (Tracer.Instance.ActiveScope != null)
        {
            Tracer.Instance.ActiveScope.Span.SetTag("user.type", userType);
        }
        
        return new UserClaims(userId, userType);
    }
}
