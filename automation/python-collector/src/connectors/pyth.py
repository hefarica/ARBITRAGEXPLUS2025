"""
============================================================================
ARCHIVO: ./services/python-collector/src/connectors/pyth.py
============================================================================

📥 ENTRADA DE DATOS:

🔄 TRANSFORMACIÓN:
  CLASES: PythConnector
  FUNCIONES: update_prices_from_pyth, main, fetch_multiple_prices

📤 SALIDA DE DATOS:

🔗 DEPENDENCIAS:
  - Any
  - ..sheets.client
  - logging

============================================================================
"""

"""
pyth.py - Conector Pyth Network para ARBITRAGEXPLUS2025

Conector para obtener precios desde Pyth Network según Prompt Supremo Definitivo.

TAREA 2.2 del Prompt Supremo:
- update_prices_from_pyth(): Actualiza precios desde Pyth Network
- fetch_pyth_price(): Obtiene precio individual de un feed
- Integración con SheetsClient para leer ASSETS y actualizar precios

CERO HARDCODING: Lee assets desde Sheets dinámicamente.
"""

import asyncio
import logging
from datetime import datetime
from typing import Any, Dict, List, Optional

import aiohttp

logger = logging.getLogger(__name__)
logger.setLevel(logging.INFO)

# Endpoint público de Pyth Network (Hermes)
PYTH_HERMES_ENDPOINT = "https://hermes.pyth.network"


class PythConnector:
    """
    Conector para Pyth Network.
    
    Implementa el protocolo del Prompt Supremo Definitivo:
    - ANTES: Validar conexión a Pyth Network
    - DURANTE: Obtener precios sin hardcoding (desde Sheets)
    - DESPUÉS: Actualizar precios en Sheets y validar
    """
    
    def __init__(self, api_url: str = PYTH_HERMES_ENDPOINT):
        """
        Inicializa el conector de Pyth Network.
        
        Args:
            api_url: URL base de Pyth Hermes API
        """
        self.api_url = api_url
        logger.info(f"✅ Conector Pyth Network inicializado: {api_url}")
    
    async def fetch_pyth_price(self, price_feed_id: str) -> Optional[Dict[str, Any]]:
        """
        Obtiene precio individual de un feed de Pyth.
        
        Args:
            price_feed_id: ID del price feed de Pyth (hex string)
            
        Returns:
            Diccionario con datos de precio o None si falla
        """
        try:
            async with aiohttp.ClientSession() as session:
                url = f"{self.api_url}/api/latest_price_feeds"
                params = {"ids[]": [price_feed_id]}
                
                async with session.get(url, params=params) as resp:
                    if resp.status != 200:
                        logger.error(f"❌ Error HTTP {resp.status} al obtener precio {price_feed_id}")
                        return None
                    
                    data = await resp.json()
                    
                    if not data or len(data) == 0:
                        logger.warning(f"⚠️  No hay datos para feed {price_feed_id}")
                        return None
                    
                    # Pyth devuelve array de feeds
                    feed_data = data[0] if isinstance(data, list) else data
                    
                    # Extraer precio y metadatos
                    price_info = {
                        'feed_id': price_feed_id,
                        'price': feed_data.get('price', {}).get('price'),
                        'expo': feed_data.get('price', {}).get('expo'),
                        'conf': feed_data.get('price', {}).get('conf'),
                        'publish_time': feed_data.get('price', {}).get('publish_time'),
                        'timestamp': datetime.now().isoformat()
                    }
                    
                    # Calcular precio normalizado
                    if price_info['price'] and price_info['expo']:
                        normalized_price = float(price_info['price']) * (10 ** price_info['expo'])
                        price_info['normalized_price'] = normalized_price
                    
                    logger.info(f"✅ Precio obtenido para {price_feed_id}: ${price_info.get('normalized_price', 'N/A')}")
                    return price_info
                    
        except aiohttp.ClientError as e:
            logger.error(f"❌ Error de conexión al obtener precio {price_feed_id}: {e}")
            return None
        except Exception as e:
            logger.error(f"❌ Error inesperado al obtener precio {price_feed_id}: {e}")
            return None
    
    async def fetch_multiple_prices(self, price_feed_ids: List[str]) -> Dict[str, Dict[str, Any]]:
        """
        Obtiene múltiples precios en batch.
        
        Args:
            price_feed_ids: Lista de IDs de price feeds
            
        Returns:
            Diccionario {feed_id: price_data}
        """
        try:
            async with aiohttp.ClientSession() as session:
                url = f"{self.api_url}/api/latest_price_feeds"
                params = {"ids[]": price_feed_ids}
                
                async with session.get(url, params=params) as resp:
                    if resp.status != 200:
                        logger.error(f"❌ Error HTTP {resp.status} al obtener precios batch")
                        return {}
                    
                    data = await resp.json()
                    
                    if not data:
                        logger.warning("⚠️  No hay datos en respuesta batch")
                        return {}
                    
                    # Procesar cada feed
                    prices = {}
                    for feed_data in data:
                        feed_id = feed_data.get('id')
                        if not feed_id:
                            continue
                        
                        price_info = {
                            'feed_id': feed_id,
                            'price': feed_data.get('price', {}).get('price'),
                            'expo': feed_data.get('price', {}).get('expo'),
                            'conf': feed_data.get('price', {}).get('conf'),
                            'publish_time': feed_data.get('price', {}).get('publish_time'),
                            'timestamp': datetime.now().isoformat()
                        }
                        
                        # Calcular precio normalizado
                        if price_info['price'] and price_info['expo']:
                            normalized_price = float(price_info['price']) * (10 ** price_info['expo'])
                            price_info['normalized_price'] = normalized_price
                        
                        prices[feed_id] = price_info
                    
                    logger.info(f"✅ Obtenidos {len(prices)} precios en batch")
                    return prices
                    
        except Exception as e:
            logger.error(f"❌ Error al obtener precios batch: {e}")
            return {}


# ============================================================================
# FUNCIÓN PRINCIPAL REQUERIDA POR PROMPT SUPREMO - TAREA 2.2
# ============================================================================

async def update_prices_from_pyth(sheets_client):
    """
    Actualiza precios desde Pyth - arrays desde Sheets.
    
    Esta es la función principal requerida por el Prompt Supremo Definitivo.
    
    Flujo:
    1. Lee assets desde ASSETS sheet (400 campos)
    2. Filtra assets que tienen pyth_price_feed_id
    3. Obtiene precios desde Pyth Network
    4. Actualiza precios en ASSETS sheet
    
    Args:
        sheets_client: Instancia de SheetsClient (de client.py)
        
    Returns:
        Número de precios actualizados
    """
    logger.info("🔄 Iniciando actualización de precios desde Pyth...")
    
    # Inicializar conector Pyth
    pyth = PythConnector()
    
    # 1. Leer assets desde Sheets (400 campos dinámicos)
    assets = await sheets_client.get_assets_array()
    
    if not assets:
        logger.warning("⚠️  No hay assets en Sheets")
        return 0
    
    logger.info(f"📊 Leídos {len(assets)} assets desde Sheets")
    
    # 2. Filtrar assets con pyth_price_feed_id
    assets_with_pyth = [
        asset for asset in assets 
        if asset.get('pyth_price_feed_id') or asset.get('PYTH_PRICE_FEED_ID')
    ]
    
    if not assets_with_pyth:
        logger.warning("⚠️  No hay assets con pyth_price_feed_id configurado")
        return 0
    
    logger.info(f"🎯 {len(assets_with_pyth)} assets tienen Pyth price feed configurado")
    
    # 3. Obtener precios desde Pyth
    updated_count = 0
    
    for asset in assets_with_pyth:
        # Obtener feed ID (puede estar en mayúsculas o minúsculas)
        feed_id = asset.get('pyth_price_feed_id') or asset.get('PYTH_PRICE_FEED_ID')
        
        if not feed_id:
            continue
        
        # Obtener precio desde Pyth
        price_data = await pyth.fetch_pyth_price(feed_id)
        
        if price_data and 'normalized_price' in price_data:
            # 4. Actualizar precio en asset
            asset_id = asset.get('id') or asset.get('ID') or asset.get('TOKEN_ADDRESS')
            
            # Actualizar campos de precio
            await sheets_client.update_asset_price(
                asset_id=asset_id,
                price_data={
                    'CURRENT_PRICE_USD': price_data['normalized_price'],
                    'PRICE_SOURCE': 'PYTH',
                    'PRICE_TIMESTAMP': price_data['timestamp'],
                    'PRICE_CONFIDENCE': price_data.get('conf'),
                    'LAST_UPDATE': datetime.now().isoformat()
                }
            )
            
            updated_count += 1
            logger.info(f"✅ Actualizado precio para {asset.get('TOKEN_SYMBOL', asset_id)}: ${price_data['normalized_price']:.6f}")
        else:
            logger.warning(f"⚠️  No se pudo obtener precio para {asset.get('TOKEN_SYMBOL', 'unknown')}")
    
    logger.info(f"🎉 Actualización completada: {updated_count}/{len(assets_with_pyth)} precios actualizados")
    return updated_count


# ============================================================================
# EJEMPLO DE USO
# ============================================================================

async def main():
    """Ejemplo de uso del conector Pyth"""
    from ..sheets.client import SheetsClient
    
    # Inicializar cliente de Sheets
    sheets_client = SheetsClient()
    
    # Actualizar precios desde Pyth
    updated = await update_prices_from_pyth(sheets_client)
    print(f"✅ Precios actualizados: {updated}")


if __name__ == "__main__":
    asyncio.run(main())

