namespace ArbitrageXStreamListener;

public class BlockchainData
{
    public Dictionary<string, object> Data { get; set; } = new();

    public string? GetString(string key) => Data.TryGetValue(key, out var value) ? value?.ToString() : null;
    public double? GetDouble(string key) => Data.TryGetValue(key, out var value) && value is double d ? d : null;
    public void SetData(string key, object? value) { if (value != null) Data[key] = value; }
}

