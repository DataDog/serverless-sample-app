using System.Threading.RateLimiting;
using FluentValidation;
using FluentValidation.AspNetCore;
using Microsoft.OpenApi.Models;
using Asp.Versioning;
using Orders.Api;
using Orders.Api.CompleteOrder;
using Orders.Api.ConfirmedOrders;
using Orders.Api.CreateOrder;
using Orders.Api.GetOrderDetails;
using Orders.Api.GetUserOrders;
using Orders.Api.Middleware;
using Orders.Api.Models;
using Orders.Api.Health;
using Orders.Api.RateLimiting;
using Orders.Api.Versioning;
using Orders.Core;
using Serilog;
using Serilog.Formatting.Compact;
using System.Text.Json;

try
{
    var builder = WebApplication.CreateBuilder(args);

    builder.Configuration
        .AddEnvironmentVariables();

    builder.Services
        .AddCore(builder.Configuration);

    // Use async authentication setup to avoid blocking calls
    await builder.Services.AddCustomJwtAuthenticationAsync(builder.Configuration);

    // Add validation
    builder.Services.AddFluentValidationAutoValidation();
    builder.Services.AddValidatorsFromAssemblyContaining<CreateOrderRequestValidator>();
    builder.Services.AddValidatorsFromAssemblyContaining<Order>();

    // Add comprehensive health checks
    builder.Services.AddHealthChecks()
        .AddCheck<DynamoDbHealthCheck>("dynamodb", tags: new[] { "ready", "database" })
        .AddCheck<MemoryHealthCheck>("memory", tags: new[] { "ready", "system" })
        .AddCheck<ApplicationHealthCheck>("application", tags: new[] { "ready", "application" });

    // Add rate limiting metrics
    builder.Services.AddSingleton<RateLimitingMetrics>();

    // Add API versioning
    builder.Services.AddProblemDetails();
    builder.Services.AddEndpointsApiExplorer();
    builder.Services.AddApiVersioning(options =>
    {
        options.DefaultApiVersion = new ApiVersion(1, 0);
        options.AssumeDefaultVersionWhenUnspecified = true;
        options.ReportApiVersions = true;
        options.ApiVersionReader = ApiVersionReader.Combine(
            new HeaderApiVersionReader("X-API-Version")
        );
    });

    // Enhanced rate limiting with user-based policies
    builder.Services.AddRateLimiter(options =>
    {
        // Default policy for anonymous/standard users
        options.AddPolicy(RateLimitPolicies.Default, httpContext =>
            RateLimitPartition.GetFixedWindowLimiter("default", partition =>
                new FixedWindowRateLimiterOptions
                {
                    PermitLimit = 30,
                    Window = TimeSpan.FromMinutes(1),
                    QueueProcessingOrder = QueueProcessingOrder.OldestFirst,
                    QueueLimit = 2
                }));

        // Premium users get higher limits
        options.AddPolicy(RateLimitPolicies.Premium, httpContext =>
            RateLimitPartition.GetSlidingWindowLimiter("premium", partition =>
                new SlidingWindowRateLimiterOptions
                {
                    PermitLimit = 200,
                    Window = TimeSpan.FromMinutes(1),
                    SegmentsPerWindow = 6, // 10-second segments for smoother rate limiting
                    QueueProcessingOrder = QueueProcessingOrder.OldestFirst,
                    QueueLimit = 10
                }));

        // Read operations have higher limits
        options.AddPolicy(RateLimitPolicies.ReadOnly, httpContext =>
            RateLimitPartition.GetSlidingWindowLimiter("readonly", partition =>
                new SlidingWindowRateLimiterOptions
                {
                    PermitLimit = 100,
                    Window = TimeSpan.FromMinutes(1),
                    SegmentsPerWindow = 4, // 15-second segments
                    QueueProcessingOrder = QueueProcessingOrder.OldestFirst,
                    QueueLimit = 5
                }));

        // Write operations have stricter limits
        options.AddPolicy(RateLimitPolicies.WriteOnly, httpContext =>
            RateLimitPartition.GetFixedWindowLimiter("writeonly", partition =>
                new FixedWindowRateLimiterOptions
                {
                    PermitLimit = 20,
                    Window = TimeSpan.FromMinutes(1),
                    QueueProcessingOrder = QueueProcessingOrder.OldestFirst,
                    QueueLimit = 2
                }));

        // Admin operations have very strict limits
        options.AddPolicy(RateLimitPolicies.AdminOperations, httpContext =>
            RateLimitPartition.GetFixedWindowLimiter("admin", partition =>
                new FixedWindowRateLimiterOptions
                {
                    PermitLimit = 10,
                    Window = TimeSpan.FromMinutes(1),
                    QueueProcessingOrder = QueueProcessingOrder.OldestFirst,
                    QueueLimit = 1
                }));

        // Global limiter with user-type based partitioning
        options.GlobalLimiter = PartitionedRateLimiter.Create<HttpContext, string>(httpContext =>
        {
            var userClaims = httpContext.User?.Claims?.ExtractUserId();
            var userType = userClaims?.UserType ?? "ANONYMOUS";
            var userId = userClaims?.UserId ?? httpContext.Connection.RemoteIpAddress?.ToString() ?? "unknown";

            // Create partition key that doesn't include PII but allows proper rate limiting
            var partitionKey = $"{userType}:{userId.GetHashCode():X}"; // Hash user ID for privacy

            return RateLimitPartition.GetSlidingWindowLimiter(partitionKey, partition =>
            {
                var (permitLimit, queueLimit) = userType switch
                {
                    "PREMIUM" => (200, 10),
                    "ADMIN" => (150, 8),
                    "STANDARD" => (60, 5),
                    _ => (30, 2)
                };

                return new SlidingWindowRateLimiterOptions
                {
                    PermitLimit = permitLimit,
                    QueueLimit = queueLimit,
                    Window = TimeSpan.FromMinutes(1),
                    SegmentsPerWindow = 6 // 10-second segments for smoother limiting
                };
            });
        });

        // Custom rejection response with proper headers
        options.OnRejected = async (context, token) =>
        {
            var metrics = context.HttpContext.RequestServices.GetService<RateLimitingMetrics>();
            var userClaims = context.HttpContext.User?.Claims?.ExtractUserId();
            var userType = userClaims?.UserType ?? "ANONYMOUS";
            var endpoint = context.HttpContext.Request.Path.ToString();

            // Record rejection metrics
            metrics?.RecordRejected("global", userType, endpoint);

            context.HttpContext.Response.StatusCode = 429;
            context.HttpContext.Response.Headers["Retry-After"] = "60";
            context.HttpContext.Response.Headers["X-RateLimit-Policy"] = "global";
            context.HttpContext.Response.Headers["X-RateLimit-Remaining"] = "0";
            
            var response = new
            {
                error = "RATE_LIMIT_EXCEEDED",
                message = "Rate limit exceeded. Please try again later.",
                retryAfter = 60,
                userType = userType,
                correlationId = context.HttpContext.Items["CorrelationId"]?.ToString() ?? Guid.NewGuid().ToString()
            };

            await context.HttpContext.Response.WriteAsJsonAsync(response, cancellationToken: token);
        };
    });

    // Add API documentation
    builder.Services.AddSwaggerGen(options =>
    {
        options.SwaggerDoc("v1", new OpenApiInfo { Title = "Orders API", Version = "v1" });

        // Include XML comments for Swagger
        var xmlFiles = Directory.GetFiles(AppContext.BaseDirectory, "*.xml");
        foreach (var xmlFile in xmlFiles) options.IncludeXmlComments(xmlFile);
    });

    // Add response compression for improved performance
    builder.Services.AddResponseCompression(options => { options.EnableForHttps = true; });

    builder.Services.AddCors(options =>
    {
        options.AddPolicy("CorsPolicy",
            builder => builder
                .AllowAnyOrigin()
                .AllowAnyMethod()
                .AllowAnyHeader());
    });

    builder.Host.UseSerilog((context, logConfig) => logConfig
        .Enrich.FromLogContext()
        .Enrich.WithProperty("Application", "Orders.Api")
        .MinimumLevel.Is(Serilog.Events.LogEventLevel.Information)
        .WriteTo.Console(new CompactJsonFormatter()));

    var app = builder.Build();

    // Add correlation ID middleware first
    app.UseCorrelationId();
    
    app.UseRateLimiter();
    
    // Add API deprecation middleware
    app.UseApiDeprecation();
    
    // Add global exception handling
    app.UseGlobalExceptionHandling();

    app.UseResponseCompression();

    // Enable Swagger UI
    app.UseSwagger();
    if (app.Environment.IsDevelopment())
        app.UseSwaggerUI(options =>
        {
            var url = $"/swagger/v1/swagger.json";
            var name = "V1";
            options.SwaggerEndpoint(url, name);
        });

    app.UseCors("CorsPolicy");

    app.UseAuthentication();

    app.UseAuthorization();

    var orders = app.NewVersionedApi("Orders");

    // Comprehensive health check endpoints
    app.MapHealthChecks("/health", new Microsoft.AspNetCore.Diagnostics.HealthChecks.HealthCheckOptions
    {
        ResponseWriter = async (context, report) =>
        {
            context.Response.ContentType = "application/json";
            
            var result = JsonSerializer.Serialize(new
            {
                status = report.Status.ToString(),
                timestamp = DateTime.UtcNow,
                duration = report.TotalDuration.TotalMilliseconds,
                version = "1.0.0",
                checks = report.Entries.Select(e => new
                {
                    name = e.Key,
                    status = e.Value.Status.ToString(),
                    description = e.Value.Description,
                    duration = e.Value.Duration.TotalMilliseconds,
                    data = e.Value.Data
                })
            }, new JsonSerializerOptions
            {
                PropertyNamingPolicy = JsonNamingPolicy.CamelCase
            });
            
            await context.Response.WriteAsync(result);
        }
    });

    // Readiness check for load balancers and orchestrators
    app.MapHealthChecks("/health/ready", new Microsoft.AspNetCore.Diagnostics.HealthChecks.HealthCheckOptions
    {
        Predicate = check => check.Tags.Contains("ready"),
        ResponseWriter = async (context, report) =>
        {
            var result = JsonSerializer.Serialize(new
            {
                status = report.Status.ToString(),
                timestamp = DateTime.UtcNow
            }, new JsonSerializerOptions
            {
                PropertyNamingPolicy = JsonNamingPolicy.CamelCase
            });
            context.Response.ContentType = "application/json";
            await context.Response.WriteAsync(result);
        }
    });

    // Simple liveness check for Kubernetes
    app.MapHealthChecks("/health/live", new Microsoft.AspNetCore.Diagnostics.HealthChecks.HealthCheckOptions
    {
        Predicate = _ => false, // Only basic runtime health
        ResponseWriter = async (context, report) =>
        {
            var result = JsonSerializer.Serialize(new
            {
                status = "Healthy",
                timestamp = DateTime.UtcNow
            }, new JsonSerializerOptions
            {
                PropertyNamingPolicy = JsonNamingPolicy.CamelCase
            });
            context.Response.ContentType = "application/json";
            await context.Response.WriteAsync(result);
        }
    });
    // Version 1 API endpoints with specific rate limiting policies
    orders.MapGet("/orders", GetUserOrdersHandler.Handle)
        .HasApiVersion(1.0)
        .WithDescription("Get orders for the authenticated user")
        .RequireRateLimiting(RateLimitPolicies.ReadOnly)
        .Produces<PaginatedResponse<OrderDto>>(200)
        .ProducesProblem(401)
        .ProducesProblem(429);
    
    orders.MapGet("/orders/confirmed", ConfirmedOrdersHandler.Handle)
        .HasApiVersion(1.0)
        .WithDescription("Get all confirmed orders (Admin only)")
        .RequireRateLimiting(RateLimitPolicies.AdminOperations)
        .Produces<PaginatedResponse<OrderDto>>(200)
        .ProducesProblem(401)
        .ProducesProblem(403)
        .ProducesProblem(429);
    
    orders.MapGet("/orders/{OrderId}", GetOrderDetailsHandler.Handle)
        .HasApiVersion(1.0)
        .WithDescription("Get details for a specific order")
        .RequireRateLimiting(RateLimitPolicies.ReadOnly)
        .Produces<OrderDto>(200)
        .ProducesProblem(401)
        .ProducesProblem(404)
        .ProducesProblem(429);
    
    orders.MapPost("/orders", CreateOrderHandler.Handle)
        .HasApiVersion(1.0)
        .WithDescription("Create a new order")
        .RequireRateLimiting(RateLimitPolicies.WriteOnly)
        .Produces<OrderDto>(201)
        .ProducesProblem(400)
        .ProducesProblem(401)
        .ProducesProblem(429);
    
    orders.MapPost("/orders/{OrderId}/complete", CompleteOrderHandler.Handle)
        .HasApiVersion(1.0)
        .WithDescription("Mark an order as complete (Admin only)")
        .RequireRateLimiting(RateLimitPolicies.AdminOperations)
        .Produces(204)
        .ProducesProblem(400)
        .ProducesProblem(401)
        .ProducesProblem(403)
        .ProducesProblem(404)
        .ProducesProblem(429);

    Log.Information("Starting up orders API version 1.0.0");

    app.Run();
}
catch (Exception ex)
{
    Log.Error(ex, "Failure starting up application");
}
finally
{
    await Log.CloseAndFlushAsync();
}