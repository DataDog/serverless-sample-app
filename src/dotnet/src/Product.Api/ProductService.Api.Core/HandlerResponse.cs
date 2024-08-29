using System.Text.Json.Serialization;

namespace ProductService.Api.Core;

public record HandlerResponse<T>(T? Data, bool IsSuccess, List<string> Message)
{
    [JsonPropertyName("isSuccess")]
    public bool IsSuccess { get; init; } = IsSuccess;
    
    [JsonPropertyName("data")]
    public T? Data { get; init; } = Data;
    
    [JsonPropertyName("message")]
    public List<string> Message { get; init; } = Message;
}