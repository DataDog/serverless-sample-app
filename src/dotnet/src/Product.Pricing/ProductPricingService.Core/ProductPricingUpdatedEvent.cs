namespace ProductPricingService.Core;

public record ProductPricingUpdatedEvent(string ProductId, Dictionary<int, decimal> PriceBrackets);