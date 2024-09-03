using System.Text.Json.Serialization;

namespace ProductApi.Core;

public class ProductDto(Product product)
{
    [JsonPropertyName("productId")]
    public string ProductId { get; set; } = product.ProductId;

    [JsonPropertyName("name")]
    public string Name { get; set; } = product.Details.Name;

    [JsonPropertyName("price")]
    public decimal Price { get; set; } = product.Details.Price;

    [JsonPropertyName("priceBrackets")]
    public Dictionary<decimal, decimal> PriceBrackets { get; set; } = product.PriceBrackets
        .Select(bracket => new KeyValuePair<decimal, decimal>(bracket.Quantity, bracket.Price)).ToDictionary();
}