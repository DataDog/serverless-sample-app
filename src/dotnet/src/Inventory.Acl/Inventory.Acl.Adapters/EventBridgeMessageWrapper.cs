using System.Text.Json.Serialization;

namespace Inventory.Acl.Adapters;

public record EventBridgeMessageWrapper<T> where T : class
{
    [JsonPropertyName("detail")]
    public T? Detail { get; set; } = default;

    [JsonPropertyName("detail-type")]
    public string DetailType { get; set; } = "";

    [JsonPropertyName("source")]
    public string Source { get; set; } = "";
}