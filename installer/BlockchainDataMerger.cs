using System.Collections.Generic;

namespace MASTER_RUNNER;

// --- Clases de Datos Definidas Aquí Mismo ---

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

public class PublicnodesData
{
    public string? rpcUrl { get; set; }
    public string health { get; set; } = "unknown";
}

public class BlockchainData
{
    public Dictionary<string, object> Data { get; set; } = new();

    public string? GetString(string key) => Data.TryGetValue(key, out var value) ? value?.ToString() : null;
    public double? GetDouble(string key) => Data.TryGetValue(key, out var value) && value is double d ? d : null;
    public void SetData(string key, object? value) { if (value != null) Data[key] = value; }
}

// --- Lógica de Fusión ---

public static class BlockchainDataMerger
{
    public static BlockchainData Merge(DefiLlamaData? defiLlama, LlamanodesData? llamanodes, PublicnodesData? publicnodes)
    {
        var mergedData = new BlockchainData();

        if (defiLlama != null)
        {
            mergedData.SetData("CHAIN_ID", defiLlama.chainId);
            mergedData.SetData("NATIVE_TOKEN", defiLlama.symbol);
            mergedData.SetData("TVL_USD", defiLlama.tvl);
            mergedData.SetData("DAILY_VOLUME_USD", defiLlama.dailyVolume);
            mergedData.SetData("TRANSACTION_COUNT", defiLlama.txns24h);
            mergedData.SetData("AVERAGE_GAS_COST", defiLlama.gasCostUSD);
        }

        if (llamanodes != null)
        {
            mergedData.SetData("BLOCKCHAIN_ID", llamanodes.name);
            mergedData.SetData("RPC_URL_1", llamanodes.rpcUrls?.FirstOrDefault());
            mergedData.SetData("RPC_URL_2", llamanodes.rpcUrls?.Skip(1).FirstOrDefault());
            mergedData.SetData("WSS_URL", llamanodes.wssUrl);
            mergedData.SetData("EXPLORER_URL", llamanodes.explorerUrl);
            mergedData.SetData("EIP1559_SUPPORTED", llamanodes.eip1559Supported);
            mergedData.SetData("MAX_GAS_PRICE", llamanodes.maxGasPrice);
            mergedData.SetData("MIN_GAS_PRICE", llamanodes.minGasPrice);
        }

        if (publicnodes != null)
        {
            if (string.IsNullOrEmpty(mergedData.GetString("RPC_URL_2")))
            {
                mergedData.SetData("RPC_URL_2", publicnodes.rpcUrl);
            }
            mergedData.SetData("HEALTH_STATUS", publicnodes.health);
        }
        
        mergedData.SetData("CREATED_AT", DateTime.UtcNow);
        mergedData.SetData("UPDATED_AT", DateTime.UtcNow);

        return mergedData;
    }
}

