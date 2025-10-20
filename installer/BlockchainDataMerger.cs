using MASTER_RUNNER.Collectors;
using ArbitrageXStreamListener;

namespace MASTER_RUNNER;

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

