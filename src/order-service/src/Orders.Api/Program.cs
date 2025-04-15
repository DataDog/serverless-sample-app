using FluentValidation;
using FluentValidation.AspNetCore;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.Versioning;
using Microsoft.AspNetCore.Mvc.Versioning.Conventions;
using Microsoft.OpenApi.Models;
using Orders.Api;
using Orders.Api.CompleteOrder;
using Orders.Api.ConfirmedOrders;
using Orders.Api.CreateOrder;
using Orders.Api.GetOrderDetails;
using Orders.Api.GetUserOrders;
using Orders.Api.Middleware;
using Orders.Api.Models;
using Orders.Core;
using Serilog;
using Serilog.Formatting.Compact;

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

    // Add API versioning
    builder.Services.AddApiVersioning(options =>
    {
        options.DefaultApiVersion = new ApiVersion(1, 0);
        options.AssumeDefaultVersionWhenUnspecified = true;
        options.ReportApiVersions = true;
        options.ApiVersionReader = ApiVersionReader.Combine(
            new HeaderApiVersionReader("X-API-Version")
        );
    });

    builder.Services.AddVersionedApiExplorer(options =>
    {
        options.GroupNameFormat = "'v'VVV";
        options.SubstituteApiVersionInUrl = true;
    });

    // Add API documentation
    builder.Services.AddEndpointsApiExplorer();
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

    // Add global exception handling
    app.UseGlobalExceptionHandling();

    app.UseResponseCompression();

    // Enable Swagger UI
    app.UseSwagger();
    app.UseSwaggerUI(options => { options.SwaggerEndpoint("/swagger/v1/swagger.json", "Orders API v1"); });

    app.UseCors("CorsPolicy");

    app.UseAuthentication();

    app.UseAuthorization();

    // Add health check endpoint with more detailed status
    app.MapGet("/health", () =>
    {
        return Results.Ok(new
        {
            Status = "Healthy",
            Timestamp = DateTime.UtcNow,
            Version = "1.0.0" // Increment this when deploying new versions
        });
    }).WithTags("Monitoring");

    var orders = app.NewVersionedApi("Orders");
    // Version 1 API endpoints
    orders.MapGet("/orders", GetUserOrdersHandler.Handle)
        .HasApiVersion(1.0)
        .WithDescription("Get orders for the authenticated user")
        .Produces<PaginatedResponse<OrderDto>>(200)
        .ProducesProblem(401);
    ;
    app.MapGet("/orders/confirmed", ConfirmedOrdersHandler.Handle)
        .HasApiVersion(1.0)
        .WithDescription("Get all confirmed orders")
        .Produces<PaginatedResponse<OrderDto>>(200)
        .ProducesProblem(401);
    app.MapGet("/orders/{OrderId}", GetOrderDetailsHandler.Handle)
        .HasApiVersion(1.0)
        .WithDescription("Get details for a specific order")
        .Produces<OrderDto>(200)
        .ProducesProblem(401)
        .ProducesProblem(404);
    app.MapPost("/orders", CreateOrderHandler.Handle)
        .HasApiVersion(1.0)
        .WithDescription("Create a new order")
        .Produces<OrderDto>(201)
        .ProducesProblem(400)
        .ProducesProblem(401);
    app.MapPost("/orders/{OrderId}/complete", CompleteOrderHandler.Handle)
        .HasApiVersion(1.0)
        .WithDescription("Mark an order as complete")
        .Produces(204)
        .ProducesProblem(400)
        .ProducesProblem(401)
        .ProducesProblem(404);

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