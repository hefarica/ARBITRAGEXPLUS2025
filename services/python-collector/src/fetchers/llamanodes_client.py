"""
LlamanodesClient - Cliente para obtener datos de RPC endpoints desde Llamanodes

Fuente: GitHub repositories de Llamanodes
- https://github.com/llamanodes/llamanodes-rpc-endpoints
"""

import logging
from typing import Any, Dict, List, Optional

import requests

from lib.rate_limiter import get_rate_limiter_manager

logger = logging.getLogger(__name__)


class LlamanodesClient:
    """Cliente para obtener endpoints RPC de Llamanodes"""

    # Endpoints RPC conocidos por blockchain
    RPC_ENDPOINTS = {
        "ethereum": {
            "RPC_URL_1": "https://eth.llamarpc.com",
            "RPC_URL_2": "https://ethereum.publicnode.com",
            "RPC_URL_3": "https://rpc.ankr.com/eth",
            "WSS_URL": "wss://eth.llamarpc.com",
            "EXPLORER_URL": "https://etherscan.io",
        },
        "polygon": {
            "RPC_URL_1": "https://polygon.llamarpc.com",
            "RPC_URL_2": "https://polygon-rpc.com",
            "RPC_URL_3": "https://rpc.ankr.com/polygon",
            "WSS_URL": "wss://polygon.llamarpc.com",
            "EXPLORER_URL": "https://polygonscan.com",
        },
        "bsc": {
            "RPC_URL_1": "https://bsc.llamarpc.com",
            "RPC_URL_2": "https://bsc-dataseed.binance.org",
            "RPC_URL_3": "https://rpc.ankr.com/bsc",
            "WSS_URL": "wss://bsc.llamarpc.com",
            "EXPLORER_URL": "https://bscscan.com",
        },
        "arbitrum": {
            "RPC_URL_1": "https://arbitrum.llamarpc.com",
            "RPC_URL_2": "https://arb1.arbitrum.io/rpc",
            "RPC_URL_3": "https://rpc.ankr.com/arbitrum",
            "WSS_URL": "wss://arbitrum.llamarpc.com",
            "EXPLORER_URL": "https://arbiscan.io",
        },
        "optimism": {
            "RPC_URL_1": "https://optimism.llamarpc.com",
            "RPC_URL_2": "https://mainnet.optimism.io",
            "RPC_URL_3": "https://rpc.ankr.com/optimism",
            "WSS_URL": "wss://optimism.llamarpc.com",
            "EXPLORER_URL": "https://optimistic.etherscan.io",
        },
        "avalanche": {
            "RPC_URL_1": "https://avalanche.public-rpc.com",
            "RPC_URL_2": "https://api.avax.network/ext/bc/C/rpc",
            "RPC_URL_3": "https://rpc.ankr.com/avalanche",
            "WSS_URL": "wss://avalanche.public-rpc.com",
            "EXPLORER_URL": "https://snowtrace.io",
        },
        "fantom": {
            "RPC_URL_1": "https://rpc.ftm.tools",
            "RPC_URL_2": "https://rpc.ankr.com/fantom",
            "RPC_URL_3": "https://rpcapi.fantom.network",
            "WSS_URL": "wss://wsapi.fantom.network",
            "EXPLORER_URL": "https://ftmscan.com",
        },
        "base": {
            "RPC_URL_1": "https://mainnet.base.org",
            "RPC_URL_2": "https://base.llamarpc.com",
            "RPC_URL_3": "https://rpc.ankr.com/base",
            "WSS_URL": "wss://base.llamarpc.com",
            "EXPLORER_URL": "https://basescan.org",
        },
    }

    # Direcciones de contratos comunes por blockchain
    CONTRACT_ADDRESSES = {
        "ethereum": {
            "MULTICALL_ADDRESS": "0xcA11bde05977b3631167028862bE2a173976CA11",
            "WETH_ADDRESS": "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2",
            "USDC_ADDRESS": "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
            "USDT_ADDRESS": "0xdAC17F958D2ee523a2206206994597C13D831ec7",
            "DAI_ADDRESS": "0x6B175474E89094C44Da98b954EedeAC495271d0F",
        },
        "polygon": {
            "MULTICALL_ADDRESS": "0xcA11bde05977b3631167028862bE2a173976CA11",
            "WETH_ADDRESS": "0x7ceB23fD6bC0adD59E62ac25578270cFf1b9f619",
            "USDC_ADDRESS": "0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174",
            "USDT_ADDRESS": "0xc2132D05D31c914a87C6611C10748AEb04B58e8F",
            "DAI_ADDRESS": "0x8f3Cf7ad23Cd3CaDbD9735AFf958023239c6A063",
        },
        "bsc": {
            "MULTICALL_ADDRESS": "0xcA11bde05977b3631167028862bE2a173976CA11",
            "WETH_ADDRESS": "0x2170Ed0880ac9A755fd29B2688956BD959F933F8",
            "USDC_ADDRESS": "0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d",
            "USDT_ADDRESS": "0x55d398326f99059fF775485246999027B3197955",
            "DAI_ADDRESS": "0x1AF3F329e8BE154074D8769D1FFa4eE058B1DBc3",
        },
        "arbitrum": {
            "MULTICALL_ADDRESS": "0xcA11bde05977b3631167028862bE2a173976CA11",
            "WETH_ADDRESS": "0x82aF49447D8a07e3bd95BD0d56f35241523fBab1",
            "USDC_ADDRESS": "0xFF970A61A04b1cA14834A43f5dE4533eBDDB5CC8",
            "USDT_ADDRESS": "0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9",
            "DAI_ADDRESS": "0xDA10009cBd5D07dd0CeCc66161FC93D7c9000da1",
        },
        "optimism": {
            "MULTICALL_ADDRESS": "0xcA11bde05977b3631167028862bE2a173976CA11",
            "WETH_ADDRESS": "0x4200000000000000000000000000000000000006",
            "USDC_ADDRESS": "0x7F5c764cBc14f9669B88837ca1490cCa17c31607",
            "USDT_ADDRESS": "0x94b008aA00579c1307B0EF2c499aD98a8ce58e58",
            "DAI_ADDRESS": "0xDA10009cBd5D07dd0CeCc66161FC93D7c9000da1",
        },
        "avalanche": {
            "MULTICALL_ADDRESS": "0xcA11bde05977b3631167028862bE2a173976CA11",
            "WETH_ADDRESS": "0x49D5c2BdFfac6CE2BFdB6640F4F80f226bc10bAB",
            "USDC_ADDRESS": "0xB97EF9Ef8734C71904D8002F8b6Bc66Dd9c48a6E",
            "USDT_ADDRESS": "0x9702230A8Ea53601f5cD2dc00fDBc13d4dF4A8c7",
            "DAI_ADDRESS": "0xd586E7F844cEa2F87f50152665BCbc2C279D8d70",
        },
    }

    def __init__(self, timeout: int = 10):
        """
        Inicializa el cliente Llamanodes.

        Args:
            timeout: Timeout para requests HTTP en segundos
        """
        self.timeout = timeout
        self.rate_limiter = get_rate_limiter_manager()
        
        logger.info("LlamanodesClient inicializado")

    def get_rpc_endpoints(self, chain_name: str) -> Dict[str, str]:
        """
        Obtiene endpoints RPC para una blockchain.

        Args:
            chain_name: Nombre de la blockchain (ej: "ethereum", "bsc")

        Returns:
            Diccionario con URLs de RPC y WSS
        """
        normalized_name = chain_name.lower()
        
        endpoints = self.RPC_ENDPOINTS.get(normalized_name, {})
        
        if endpoints:
            logger.info(f"Obtenidos {len(endpoints)} endpoints para '{chain_name}'")
        else:
            logger.warning(f"No hay endpoints configurados para '{chain_name}'")

        return endpoints

    def get_contract_addresses(self, chain_name: str) -> Dict[str, str]:
        """
        Obtiene direcciones de contratos comunes para una blockchain.

        Args:
            chain_name: Nombre de la blockchain

        Returns:
            Diccionario con direcciones de contratos
        """
        normalized_name = chain_name.lower()
        
        addresses = self.CONTRACT_ADDRESSES.get(normalized_name, {})
        
        if addresses:
            logger.info(f"Obtenidas {len(addresses)} direcciones de contratos para '{chain_name}'")
        else:
            logger.warning(f"No hay direcciones configuradas para '{chain_name}'")

        return addresses

    def test_rpc_endpoint(self, rpc_url: str) -> Dict[str, Any]:
        """
        Prueba la conectividad y latencia de un endpoint RPC.

        Args:
            rpc_url: URL del endpoint RPC

        Returns:
            Diccionario con resultados del test
        """
        # Aplicar rate limiting
        self.rate_limiter.acquire('llamanodes', blocking=True)

        import time
        
        result = {
            "url": rpc_url,
            "success": False,
            "latency_ms": None,
            "block_number": None,
            "error": None
        }

        try:
            # Hacer request eth_blockNumber
            start_time = time.time()
            
            response = requests.post(
                rpc_url,
                json={
                    "jsonrpc": "2.0",
                    "method": "eth_blockNumber",
                    "params": [],
                    "id": 1
                },
                timeout=self.timeout,
                headers={"Content-Type": "application/json"}
            )
            
            latency = (time.time() - start_time) * 1000  # ms
            
            response.raise_for_status()
            data = response.json()
            
            if "result" in data:
                block_number = int(data["result"], 16)
                result.update({
                    "success": True,
                    "latency_ms": round(latency, 2),
                    "block_number": block_number
                })
                logger.debug(f"RPC test OK: {rpc_url} - {latency:.0f}ms, block {block_number}")
            else:
                result["error"] = data.get("error", "Unknown error")

        except Exception as e:
            result["error"] = str(e)
            logger.warning(f"RPC test failed: {rpc_url} - {e}")

        return result

    def extract_blockchain_data(self, chain_name: str) -> Dict[str, Any]:
        """
        Extrae datos de RPC y contratos para una blockchain.

        Args:
            chain_name: Nombre de la blockchain

        Returns:
            Diccionario con datos estructurados para Excel
        """
        endpoints = self.get_rpc_endpoints(chain_name)
        contracts = self.get_contract_addresses(chain_name)

        # Test del primer RPC endpoint para obtener latencia
        latency_ms = None
        last_block = None
        
        if "RPC_URL_1" in endpoints:
            test_result = self.test_rpc_endpoint(endpoints["RPC_URL_1"])
            if test_result["success"]:
                latency_ms = test_result["latency_ms"]
                last_block = test_result["block_number"]

        # Estructurar datos
        extracted = {
            **endpoints,
            **contracts,
            "LATENCY_MS": latency_ms,
            "LAST_BLOCK_NUMBER": last_block,
            "HEALTH_STATUS": "healthy" if latency_ms and latency_ms < 1000 else "degraded",
        }

        logger.info(f"Datos extraídos de Llamanodes para '{chain_name}': {len(extracted)} campos")
        
        return extracted

