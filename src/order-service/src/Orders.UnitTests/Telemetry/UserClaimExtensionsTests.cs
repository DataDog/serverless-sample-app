// Unless explicitly stated otherwise all files in this repository are licensed under the Apache License Version 2.0.
// This product includes software developed at Datadog (https://www.datadoghq.com/).
// Copyright 2025 Datadog, Inc.

using System.Security.Claims;
using Orders.Api;

namespace Orders.UnitTests.Telemetry;

public class UserClaimExtensionsTests
{
    [Fact]
    public void ExtractUserId_WithValidClaims_ReturnsUserClaims()
    {
        // Arrange
        var claims = new List<Claim>
        {
            new("http://schemas.xmlsoap.org/ws/2005/05/identity/claims/nameidentifier", "user-123"),
            new("user_type", "ADMIN")
        };

        // Act
        var result = claims.ExtractUserId();

        // Assert
        result.Should().NotBeNull();
        result!.UserId.Should().Be("user-123");
        result.UserType.Should().Be("ADMIN");
    }

    [Fact]
    public void ExtractUserId_WithNullClaims_ReturnsNull()
    {
        // Arrange
        IEnumerable<Claim>? claims = null;

        // Act
        var result = claims.ExtractUserId();

        // Assert
        result.Should().BeNull();
    }

    [Fact]
    public void ExtractUserId_WithMissingClaims_ReturnsNullValues()
    {
        // Arrange
        var claims = new List<Claim>
        {
            new("some_other_claim", "value")
        };

        // Act
        var result = claims.ExtractUserId();

        // Assert
        result.Should().NotBeNull();
        result!.UserId.Should().BeNull();
        result.UserType.Should().BeNull();
    }
}
