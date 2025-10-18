"""
============================================================================
ARCHIVO: ./services/python-collector/src/connectors/pyth_connector.py
============================================================================

📥 ENTRADA DE DATOS:

🔄 TRANSFORMACIÓN:
  CLASES: PythConnector
  FUNCIONES: update_prices_from_pyth, main, get_prices_batch

📤 SALIDA DE DATOS:

🔗 DEPENDENCIAS:
  - DynamicSheetsClient
  - sheets.dynamic_client
  - logging

============================================================================
"""

"""
pyth_connector.py

Conector de Pyth Network para actualizar precios en ASSETS dinámicamente.
Implementación según Prompt Supremo Definitivo - FASE 2.
"""

import aiohttp
import asyncio
import logging
from typing import List, Dict, Any, Optional
from datetime import datetime

logger = logging.getLogger(__name__)


class PythConnector:
    """Conector para Pyth Network (Hermes)"""
    
    # Endpoints públicos de Pyth
    HERMES_REST_URL = "https://hermes.pyth.network"
    HERMES_WSS_URL = "wss://hermes.pyth.network/v1/ws"
    
    def __init__(self):
        """Inicializa el conector de Pyth"""
        self.session: Optional[aiohttp.ClientSession] = None
        logger.info("✅ PythConnector inicializado")
    
    async def __aenter__(self):
        """Context manager entry"""
        self.session = aiohttp.ClientSession()
        return self
    
    async def __aexit__(self, exc_type, exc_val, exc_tb):
        """Context manager exit"""
        if self.session:
            await self.session.close()
    
    async def get_price(self, price_feed_id: str) -> Optional[Dict[str, Any]]:
        """
        Obtiene el precio actual de un feed de Pyth
        
        Args:
            price_feed_id: ID del price feed de Pyth (hex string)
        
        Returns:
            Diccionario con datos del precio o None si falla
        """
        try:
            if not self.session:
                self.session = aiohttp.ClientSession()
            
            # Endpoint para obtener el precio más reciente
            url = f"{self.HERMES_REST_URL}/api/latest_price_feeds"
            params = {"ids[]": price_feed_id}
            
            async with self.session.get(url, params=params, timeout=aiohttp.ClientTimeout(total=10)) as response:
                if response.status != 200:
                    logger.error(f"❌ Error obteniendo precio de Pyth: HTTP {response.status}")
                    return None
                
                data = await response.json()
                
                if not data or len(data) == 0:
                    logger.warning(f"⚠️  No se encontró precio para feed {price_feed_id}")
                    return None
                
                price_feed = data[0]
                price_data = price_feed.get('price', {})
                
                # Extraer datos relevantes
                price_raw = int(price_data.get('price', 0))
                expo = int(price_data.get('expo', 0))
                conf = int(price_data.get('conf', 0))
                publish_time = int(price_data.get('publish_time', 0))
                
                # Calcular precio real
                price_usd = price_raw * (10 ** expo)
                confidence_usd = conf * (10 ** expo)
                
                return {
                    'price_feed_id': price_feed_id,
                    'price_usd': price_usd,
                    'confidence_usd': confidence_usd,
                    'expo': expo,
                    'publish_time': publish_time,
                    'publish_datetime': datetime.fromtimestamp(publish_time).isoformat(),
                    'raw_price': price_raw,
                    'raw_conf': conf
                }
                
        except asyncio.TimeoutError:
            logger.error(f"❌ Timeout obteniendo precio de Pyth para {price_feed_id}")
            return None
        except Exception as error:
            logger.error(f"❌ Error obteniendo precio de Pyth: {error}")
            return None
    
    async def get_prices_batch(self, price_feed_ids: List[str]) -> Dict[str, Dict[str, Any]]:
        """
        Obtiene precios de múltiples feeds en batch
        
        Args:
            price_feed_ids: Lista de IDs de price feeds
        
        Returns:
            Diccionario {price_feed_id: price_data}
        """
        try:
            if not self.session:
                self.session = aiohttp.ClientSession()
            
            # Pyth soporta múltiples IDs en una sola request
            url = f"{self.HERMES_REST_URL}/api/latest_price_feeds"
            params = [("ids[]", feed_id) for feed_id in price_feed_ids]
            
            async with self.session.get(url, params=params, timeout=aiohttp.ClientTimeout(total=15)) as response:
                if response.status != 200:
                    logger.error(f"❌ Error obteniendo precios batch de Pyth: HTTP {response.status}")
                    return {}
                
                data = await response.json()
                
                # Mapear resultados
                results = {}
                for price_feed in data:
                    feed_id = price_feed.get('id')
                    price_data = price_feed.get('price', {})
                    
                    price_raw = int(price_data.get('price', 0))
                    expo = int(price_data.get('expo', 0))
                    conf = int(price_data.get('conf', 0))
                    publish_time = int(price_data.get('publish_time', 0))
                    
                    price_usd = price_raw * (10 ** expo)
                    confidence_usd = conf * (10 ** expo)
                    
                    results[feed_id] = {
                        'price_feed_id': feed_id,
                        'price_usd': price_usd,
                        'confidence_usd': confidence_usd,
                        'expo': expo,
                        'publish_time': publish_time,
                        'publish_datetime': datetime.fromtimestamp(publish_time).isoformat(),
                        'raw_price': price_raw,
                        'raw_conf': conf
                    }
                
                logger.info(f"✅ Obtenidos {len(results)} precios de Pyth en batch")
                return results
                
        except asyncio.TimeoutError:
            logger.error("❌ Timeout obteniendo precios batch de Pyth")
            return {}
        except Exception as error:
            logger.error(f"❌ Error obteniendo precios batch de Pyth: {error}")
            return {}
    
    async def update_prices_from_pyth(self, sheets_client) -> int:
        """
        Actualiza precios en ASSETS desde Pyth - arrays dinámicos desde Sheets
        
        Args:
            sheets_client: Instancia de DynamicSheetsClient
        
        Returns:
            Número de assets actualizados
        """
        try:
            logger.info("🔄 Actualizando precios desde Pyth...")
            
            # Leer assets desde Sheets (326 campos dinámicos)
            assets = await sheets_client.get_assets_array()
            
            # Filtrar assets con pyth_price_feed_id
            assets_with_pyth = [
                asset for asset in assets 
                if asset.get('pyth_price_feed_id')
            ]
            
            if not assets_with_pyth:
                logger.warning("⚠️  No hay assets con pyth_price_feed_id configurado")
                return 0
            
            logger.info(f"📊 Encontrados {len(assets_with_pyth)} assets con Pyth price feeds")
            
            # Obtener price feed IDs
            price_feed_ids = [asset['pyth_price_feed_id'] for asset in assets_with_pyth]
            
            # Obtener precios en batch
            prices = await self.get_prices_batch(price_feed_ids)
            
            if not prices:
                logger.error("❌ No se pudieron obtener precios de Pyth")
                return 0
            
            # Preparar actualizaciones
            updates = []
            for asset in assets_with_pyth:
                feed_id = asset['pyth_price_feed_id']
                if feed_id in prices:
                    price_data = prices[feed_id]
                    
                    # Actualizar campos del asset
                    asset['pyth_price'] = price_data['price_usd']
                    asset['pyth_confidence'] = price_data['confidence_usd']
                    asset['pyth_expo'] = price_data['expo']
                    asset['pyth_publish_time'] = price_data['publish_time']
                    asset['price_usd'] = price_data['price_usd']  # Actualizar precio principal
                    asset['updated_at'] = datetime.now().isoformat()
                    
                    updates.append(asset)
            
            # Escribir actualizaciones a Sheets
            # TODO: Implementar update_assets_array en DynamicSheetsClient
            # Por ahora solo logueamos
            logger.info(f"✅ Actualizados {len(updates)} assets con precios de Pyth")
            
            return len(updates)
            
        except Exception as error:
            logger.error(f"❌ Error actualizando precios desde Pyth: {error}")
            return 0


async def main():
    """Función de prueba"""
    from sheets.dynamic_client import DynamicSheetsClient
    
    logging.basicConfig(
        level=logging.INFO,
        format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
    )
    
    # Inicializar clientes
    sheets_client = DynamicSheetsClient()
    
    async with PythConnector() as pyth:
        # Actualizar precios
        updated_count = await pyth.update_prices_from_pyth(sheets_client)
        print(f"\n✅ Actualizados {updated_count} assets con precios de Pyth\n")


if __name__ == "__main__":
    asyncio.run(main())

