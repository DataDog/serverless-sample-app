// Unless explicitly stated otherwise all files in this repository are licensed under the Apache License Version 2.0.
// This product includes software developed at Datadog (https://www.datadoghq.com/).
// Copyright 2025 Datadog, Inc.

using Orders.Api;

namespace Orders.UnitTests.Api;

public class JwtValidationTests
{
    private const string TestSecretKey = "this-is-a-test-secret-key-that-is-long-enough-for-hmac";
    private const string TestIssuer = "orders-api";
    private const string TestAudience = "orders-clients";

    [Fact]
    public void NonLocalEnvironment_ShouldValidateTokenLifetime()
    {
        var parameters = ServiceExtensions.CreateTokenValidationParameters("production", TestSecretKey, TestIssuer, TestAudience);

        parameters.ValidateLifetime.Should().BeTrue();
    }

    [Fact]
    public void NonLocalEnvironment_ShouldValidateIssuer()
    {
        var parameters = ServiceExtensions.CreateTokenValidationParameters("production", TestSecretKey, TestIssuer, TestAudience);

        parameters.ValidateIssuer.Should().BeTrue();
    }

    [Fact]
    public void NonLocalEnvironment_ShouldValidateAudience()
    {
        var parameters = ServiceExtensions.CreateTokenValidationParameters("production", TestSecretKey, TestIssuer, TestAudience);

        parameters.ValidateAudience.Should().BeTrue();
    }

    [Fact]
    public void NonLocalEnvironment_ShouldValidateIssuerSigningKey()
    {
        var parameters = ServiceExtensions.CreateTokenValidationParameters("production", TestSecretKey, TestIssuer, TestAudience);

        parameters.ValidateIssuerSigningKey.Should().BeTrue();
    }

    [Fact]
    public void LocalEnvironment_ShouldNotValidateLifetime()
    {
        var parameters = ServiceExtensions.CreateTokenValidationParameters("local", TestSecretKey);

        parameters.ValidateLifetime.Should().BeFalse();
    }

    [Fact]
    public void LocalEnvironment_ShouldNotValidateIssuer()
    {
        var parameters = ServiceExtensions.CreateTokenValidationParameters("local", TestSecretKey);

        parameters.ValidateIssuer.Should().BeFalse();
    }

    [Fact]
    public void LocalEnvironment_ShouldNotValidateAudience()
    {
        var parameters = ServiceExtensions.CreateTokenValidationParameters("local", TestSecretKey);

        parameters.ValidateAudience.Should().BeFalse();
    }

    [Fact]
    public void LocalEnvironment_ShouldStillValidateIssuerSigningKey()
    {
        var parameters = ServiceExtensions.CreateTokenValidationParameters("local", TestSecretKey);

        parameters.ValidateIssuerSigningKey.Should().BeTrue();
    }

    [Fact]
    public void NullEnvironment_ShouldValidateTokenLifetime()
    {
        var parameters = ServiceExtensions.CreateTokenValidationParameters(null, TestSecretKey, TestIssuer, TestAudience);

        parameters.ValidateLifetime.Should().BeTrue();
    }

    [Fact]
    public void IssuerSigningKey_ShouldBeSetFromSecretKey()
    {
        var parameters = ServiceExtensions.CreateTokenValidationParameters("production", TestSecretKey, TestIssuer, TestAudience);

        parameters.IssuerSigningKey.Should().NotBeNull();
    }

    [Fact]
    public void NonLocalEnvironment_ShouldSetValidIssuerAndAudience()
    {
        var parameters = ServiceExtensions.CreateTokenValidationParameters("production", TestSecretKey, TestIssuer, TestAudience);

        parameters.ValidIssuer.Should().Be(TestIssuer);
        parameters.ValidAudience.Should().Be(TestAudience);
    }

    [Fact]
    public void NonLocalEnvironment_WithoutIssuer_ShouldNotValidateIssuer()
    {
        var parameters = ServiceExtensions.CreateTokenValidationParameters("production", TestSecretKey);

        parameters.ValidateIssuer.Should().BeFalse();
    }

    [Fact]
    public void NonLocalEnvironment_WithoutAudience_ShouldNotValidateAudience()
    {
        var parameters = ServiceExtensions.CreateTokenValidationParameters("production", TestSecretKey);

        parameters.ValidateAudience.Should().BeFalse();
    }
}
