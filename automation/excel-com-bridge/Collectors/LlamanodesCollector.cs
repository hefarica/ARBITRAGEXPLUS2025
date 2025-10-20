using System.Text.Json;
using System.Text.Json.Serialization;

namespace MASTER_RUNNER.Collectors;

public class LlamanodesData
{
    public string name { get; set; } = "";
    public string chainId { get; set; } = "";
    public List<string>? rpcUrls { get; set; }
    public string? wssUrl { get; set; }
    public string? explorerUrl { get; set; }
    public bool eip1559Supported { get; set; }
    public double? maxGasPrice { get; set; }
    public double? minGasPrice { get; set; }
}

public class LlamanodesCollector
{
    private static readonly HttpClient _client = new();
    private static readonly JsonSerializerOptions _options = new() { PropertyNameCaseInsensitive = true };

    public static async Task<LlamanodesData?> GetDataAsync(string chainName)
    {
        try
        {
            // El nombre del archivo en GitHub suele ser el nombre de la cadena en minúsculas
            string fileName = $"{chainName}.json";
            string url = $"https://raw.githubusercontent.com/llamanodes/llamanodes/main/chains/{fileName}";
            
            var jsonContent = await _client.GetStringAsync(url);
            return JsonSerializer.Deserialize<LlamanodesData>(jsonContent, _options);
        }
        catch (Exception ex)
        {
            Console.WriteLine($"[Llamanodes] Error fetching data for '{chainName}': {ex.Message}");
            return null;
        }
    }
}

