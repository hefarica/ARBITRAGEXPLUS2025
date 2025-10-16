/**
 * Chains Configuration - Configuración dinámica de chains desde Google Sheets
 * 
 * Premisas:
 * 1. Configuración desde Google Sheets (BLOCKCHAINS hoja)
 * 2. Arrays dinámicos de chains (map, filter)
 * 3. Consumido por chains/manager.ts
 */

export interface ChainConfig {
  chainId: number;
  name: string;
  rpcUrl: string;
  explorerUrl: string;
  nativeCurrency: {
    name: string;
    symbol: string;
    decimals: number;
  };
  gasLimit: number;
  maxPriorityFeePerGas?: string;
  maxFeePerGas?: string;
  enabled: boolean;
}

export interface ChainsConfigData {
  chains: ChainConfig[];
  defaultChainId: number;
}

/**
 * Carga la configuración de chains desde Google Sheets
 * 
 * En producción, esto debería leer desde la hoja BLOCKCHAINS de Google Sheets.
 * Por ahora, retorna una configuración por defecto que será reemplazada
 * por los datos reales desde Sheets.
 * 
 * @returns Configuración de chains
 */
export async function loadChainsConfig(): Promise<ChainsConfigData> {
  // TODO: Implementar lectura desde Google Sheets
  // const sheetsClient = new GoogleSheetsClient();
  // const data = await sheetsClient.readRange('BLOCKCHAINS!A2:H100');
  // return parseChainsFromSheets(data);
  
  // Configuración por defecto (será reemplazada por Sheets)
  return {
    defaultChainId: 42161, // Arbitrum
    chains: [
      {
        chainId: 42161,
        name: 'Arbitrum One',
        rpcUrl: process.env.ARBITRUM_RPC_URL || 'https://arb1.arbitrum.io/rpc',
        explorerUrl: 'https://arbiscan.io',
        nativeCurrency: {
          name: 'Ether',
          symbol: 'ETH',
          decimals: 18,
        },
        gasLimit: 3000000,
        enabled: true,
      },
      {
        chainId: 8453,
        name: 'Base',
        rpcUrl: process.env.BASE_RPC_URL || 'https://mainnet.base.org',
        explorerUrl: 'https://basescan.org',
        nativeCurrency: {
          name: 'Ether',
          symbol: 'ETH',
          decimals: 18,
        },
        gasLimit: 3000000,
        enabled: true,
      },
      {
        chainId: 56,
        name: 'BNB Smart Chain',
        rpcUrl: process.env.BSC_RPC_URL || 'https://bsc-dataseed.binance.org',
        explorerUrl: 'https://bscscan.com',
        nativeCurrency: {
          name: 'BNB',
          symbol: 'BNB',
          decimals: 18,
        },
        gasLimit: 3000000,
        enabled: true,
      },
    ],
  };
}

/**
 * Parsea datos de Google Sheets en formato ChainConfig[]
 * 
 * Formato esperado de Sheets:
 * | ChainID | Name | RPC_URL | Explorer | Symbol | Decimals | GasLimit | Enabled |
 * 
 * @param data Datos desde Sheets (array de arrays)
 * @returns Array de ChainConfig
 */
export function parseChainsFromSheets(data: any[][]): ChainConfig[] {
  return data
    .filter(row => row.length >= 8 && row[7] === 'TRUE') // Solo chains enabled
    .map(row => ({
      chainId: parseInt(row[0]),
      name: row[1],
      rpcUrl: row[2],
      explorerUrl: row[3],
      nativeCurrency: {
        name: row[4],
        symbol: row[4],
        decimals: parseInt(row[5]) || 18,
      },
      gasLimit: parseInt(row[6]) || 3000000,
      enabled: row[7] === 'TRUE',
    }));
}

/**
 * Obtiene la configuración de una chain específica por chainId
 * @param chainId ID de la chain
 * @returns ChainConfig o undefined
 */
export async function getChainConfig(chainId: number): Promise<ChainConfig | undefined> {
  const config = await loadChainsConfig();
  return config.chains.find(chain => chain.chainId === chainId);
}

/**
 * Obtiene todas las chains habilitadas
 * @returns Array de ChainConfig habilitadas
 */
export async function getEnabledChains(): Promise<ChainConfig[]> {
  const config = await loadChainsConfig();
  return config.chains.filter(chain => chain.enabled);
}

/**
 * Valida si una chain está habilitada
 * @param chainId ID de la chain
 * @returns true si está habilitada
 */
export async function isChainEnabled(chainId: number): Promise<boolean> {
  const chain = await getChainConfig(chainId);
  return chain?.enabled || false;
}

export default {
  loadChainsConfig,
  parseChainsFromSheets,
  getChainConfig,
  getEnabledChains,
  isChainEnabled,
};

