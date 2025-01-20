using Amazon;
using Amazon.DynamoDBv2;
using Amazon.EventBridge;
using Inventory.Api.Adapters;
using Inventory.Api.Core;
using Inventory.Api.GetProductStock;
using Inventory.Api.UpdateProductStock;
using Serilog;
using Serilog.Formatting.Compact;

Log.Logger = new LoggerConfiguration()
    .Enrich.FromLogContext()
    .MinimumLevel.Is(Serilog.Events.LogEventLevel.Information)
    .WriteTo.Console(new CompactJsonFormatter())
    .CreateBootstrapLogger();

try
{
    var builder = WebApplication.CreateBuilder(args);
    Log.Information("Staring up logging");

    builder.Services.AddLogging();

    builder.Host.UseSerilog((context, logConfig) => logConfig
        .Enrich.FromLogContext()
        .MinimumLevel.Is(Serilog.Events.LogEventLevel.Information)
        .WriteTo.Console(new CompactJsonFormatter()));

    Log.Information("Adding services");

    var regionEndpoint = RegionEndpoint.GetBySystemName(Environment.GetEnvironmentVariable("AWS_REGION"));

    builder.Services.AddSingleton(new AmazonDynamoDBClient(regionEndpoint));
    builder.Services.AddSingleton(new AmazonEventBridgeClient(regionEndpoint));
    builder.Services.AddSingleton<InventoryItems, DynamoDbInventoryItems>();
    builder.Services.AddSingleton<EventPublisher, EventBridgeEventPublisher>();

    Log.Information("Setup DI");

    var app = builder.Build();

    app.MapGet("/health", () => Results.Ok("Healthy!"));

    app.MapGet("/inventory/{productId}", GetProductStockHandler.Handle);
    app.MapPost("/inventory", UpdateProductStockHandler.Handle);

    Log.Information("Starting up application");

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