using System.Text.Json.Serialization;

namespace ProductApi.Core.PricingChanged;

public record PricingUpdatedEvent
{
    [JsonPropertyName("productId")]
    public string ProductId { get; set; } = "";
    
    [JsonPropertyName("priceBrackets")] 
    public Dictionary<decimal, decimal> PriceBrackets { get; set; } = new(0);
}