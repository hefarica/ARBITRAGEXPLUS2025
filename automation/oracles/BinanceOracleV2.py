import asyncio
import aiohttp
import json
import time
import logging
import os
from dotenv import load_dotenv

# Cargar variables de entorno
load_dotenv()

# Configuración
API_URL = os.getenv("API_URL", "http://localhost:8009/api/v1/prices")
API_KEY = os.getenv("API_SECRET_KEY", "tu-super-secreto-unico-y-muy-largo-12345!@#$%")
ORACLE_NAME = "binance"
FETCH_INTERVAL = 10  # segundos

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(ORACLE_NAME)

async def fetch_binance_data():
    """Obtiene precios y volumen desde Binance."""
    async with aiohttp.ClientSession() as session:
        try:
            url = "https://api.binance.com/api/v3/ticker/24hr"
            async with session.get(url) as resp:
                if resp.status == 200:
                    data = await resp.json()
                    return data
                else:
                    logger.error(f"Error fetching Binance data: {resp.status}")
                    return []
        except Exception as e:
            logger.error(f"Exception fetching Binance data: {e}")
            return []

async def send_to_api(symbol, price, timestamp):
    """Envía datos de precio a la API local."""
    async with aiohttp.ClientSession() as session:
        try:
            payload = {
                "symbol": symbol,
                "price": price,
                "timestamp": timestamp,
                "source": ORACLE_NAME
            }
            headers = {
                "Content-Type": "application/json",
                "X-API-Key": API_KEY
            }
            async with session.post(API_URL, json=payload, headers=headers) as resp:
                if resp.status == 200:
                    logger.info(f"Sent {symbol}: {price}")
                else:
                    logger.error(f"Error sending to API: {resp.status}")
        except Exception as e:
            logger.error(f"Exception sending to API: {e}")

async def main():
    logger.info("Binance Oracle V2 iniciado")
    logger.info(f"API URL: {API_URL}")
    
    while True:
        try:
            data = await fetch_binance_data()
            
            if data:
                # Filtrar solo los pares más relevantes (USDT)
                for item in data:
                    symbol = item.get("symbol", "")
                    if symbol.endswith("USDT"):
                        price = float(item.get("lastPrice", 0))
                        timestamp = int(time.time() * 1000)
                        
                        if price > 0:
                            await send_to_api(symbol, price, timestamp)
            
            await asyncio.sleep(FETCH_INTERVAL)
            
        except Exception as e:
            logger.error(f"Error in main loop: {e}")
            await asyncio.sleep(FETCH_INTERVAL)

if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        logger.info("Oráculo detenido por el usuario")

