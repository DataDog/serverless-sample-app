using Orders.Api;
using Orders.Api.CompleteOrder;
using Orders.Api.ConfirmedOrders;
using Orders.Api.CreateOrder;
using Orders.Api.GetOrderDetails;
using Orders.Api.GetUserOrders;
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
    
    // Add response compression for improved performance
    builder.Services.AddResponseCompression(options =>
    {
        options.EnableForHttps = true;
    });
    
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
        .MinimumLevel.Is(Serilog.Events.LogEventLevel.Information)
        .WriteTo.Console(new CompactJsonFormatter()));

    var app = builder.Build();
    
    app.UseResponseCompression();
    
    app.UseCors("CorsPolicy");

    app.UseAuthentication();

    app.UseAuthorization();

    // Add health check endpoint with more detailed status
    app.MapGet("/health", () => 
    {
        return Results.Ok(new 
        { 
            Status = "Healthy",
            Timestamp = DateTime.UtcNow
        });
    });
    
    app.MapGet("/orders", GetUserOrdersHandler.Handle);
    app.MapGet("/orders/confirmed", ConfirmedOrdersHandler.Handle);
    app.MapGet("/orders/{OrderId}", GetOrderDetailsHandler.Handle);
    app.MapPost("/orders", CreateOrderHandler.Handle);
    app.MapPost("/orders/{OrderId}/complete", CompleteOrderHandler.Handle);

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