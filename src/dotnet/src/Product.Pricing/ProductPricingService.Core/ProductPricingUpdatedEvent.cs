using System.Text.Json.Serialization;

namespace ProductPricingService.Core;

public record ProductPricingUpdatedEvent(Dictionary<int, decimal> priceBrackets)
{
    [JsonPropertyName("priceBrackets")]
    private Dictionary<int, decimal> PriceBrackets { get; set; } = priceBrackets;
}