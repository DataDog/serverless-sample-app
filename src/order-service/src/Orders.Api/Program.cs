using Orders.Api;
using Orders.Api.CreateOrder;
using Orders.Api.GetOrderDetails;
using Orders.Core;
using Serilog;
using Serilog.Formatting.Compact;

try
{
    var builder = WebApplication.CreateBuilder(args);
    
    builder.Configuration
        .AddEnvironmentVariables();

    builder.Services
        .AddCore(builder.Configuration)
        .AddCustomJwtAuthentication(builder.Configuration);
    
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
    
    app.UseCors("CorsPolicy");

    app.UseAuthentication();

    app.UseAuthorization();

    app.MapGet("/health", () => Results.Ok("Healthy!"));
    app.MapGet("/orders/{orderId}", GetOrderDetailsHandler.Handle);
    app.MapPost("/orders", CreateOrderHandler.Handle);

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