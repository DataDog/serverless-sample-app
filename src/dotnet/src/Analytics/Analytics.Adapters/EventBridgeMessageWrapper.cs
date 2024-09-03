using System.Text.Json.Serialization;

namespace Analytics.Adapters;

public record EventBridgeMessageWrapper
{
    [JsonPropertyName("detail-type")]
    public string DetailType { get; set; } = "";

    [JsonPropertyName("source")]
    public string Source { get; set; } = "";
}