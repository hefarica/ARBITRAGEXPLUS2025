using System.Text.Json;
using System.Text.Json.Serialization;

namespace MASTER_RUNNER.Collectors;

public class DefiLlamaData
{
    public string name { get; set; } = "";
    public string chainId { get; set; } = "";
    public string symbol { get; set; } = "";
    public double tvl { get; set; }
    public double dailyVolume { get; set; }
    public double txns24h { get; set; }
    public double gasCostUSD { get; set; }
}

public class DefiLlamaChainList
{
    [JsonExtensionData]
    public Dictionary<string, DefiLlamaData>? chains { get; set; }
}

public class DefiLlamaCollector
{
    private static readonly HttpClient _client = new();
    private static readonly JsonSerializerOptions _options = new() { PropertyNameCaseInsensitive = true };

    public static async Task<DefiLlamaData?> GetDataAsync(string chainName)
    {
        try
        {
            // 1. Obtener la lista de todas las cadenas para encontrar el chainId
            var allChainsResponse = await _client.GetStringAsync("https://api.llama.fi/v2/chains");
            var allChains = JsonSerializer.Deserialize<DefiLlamaChainList>(allChainsResponse, _options);

            var chainEntry = allChains?.chains?.FirstOrDefault(kvp => kvp.Value.name.ToLower().Contains(chainName));
            if (chainEntry == null || string.IsNullOrEmpty(chainEntry.Value.Key))
            {
                Console.WriteLine($"[DefiLlama] No se encontró la cadena '{chainName}'");
                return null;
            }

            // 2. Obtener datos detallados de la cadena encontrada
            var chainId = chainEntry.Value.Key;
            var detailedResponse = await _client.GetStringAsync($"https://api.llama.fi/v2/chains/{chainId}");
            return JsonSerializer.Deserialize<DefiLlamaData>(detailedResponse, _options);
        }
        catch (Exception ex)
        {
            Console.WriteLine($"[DefiLlama] Error fetching data for '{chainName}': {ex.Message}");
            return null;
        }
    }
}

