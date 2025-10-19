"""
============================================================================
ARCHIVO: ./services/python-collector/src/test_pyth_connector.py
============================================================================

📥 ENTRADA DE DATOS:

🔄 TRANSFORMACIÓN:
  FUNCIONES: handle_price_update, main

📤 SALIDA DE DATOS:

🔗 DEPENDENCIAS:
  - .env
  - load_dotenv
  - dotenv

============================================================================
"""

import os
import sys
import asyncio
from dotenv import load_dotenv

# Add the src directory to the Python path
sys.path.append(os.path.join(os.path.dirname(__file__), 'connectors'))

from pyth import PythConnector

# Load environment variables from .env file
dotenv_path = os.path.abspath(os.path.join(os.path.dirname(__file__), '../../../.env'))
print(f"Attempting to load .env from: {dotenv_path}")
load_dotenv(dotenv_path=dotenv_path)

PYTH_ENDPOINT = os.getenv('PYTH_ENDPOINT')

print(f"PYTH_ENDPOINT after getenv: {PYTH_ENDPOINT}")

if not PYTH_ENDPOINT:
    print("Error: PYTH_ENDPOINT not found in .env")
    sys.exit(1)

price_updates = []

def handle_price_update(product_id: str, price: float, conf: int):
    print(f"Pyth Price Update: Product ID={product_id}, Price={price}, Confidence={conf}")
    price_updates.append((product_id, price, conf))

async def main():
    print("Starting PythConnector test...")
    connector = PythConnector(PYTH_ENDPOINT, handle_price_update)

    # Start connection in a background task
    connection_task = asyncio.create_task(connector.connect())

    # Give some time for connection to establish
    await asyncio.sleep(5)

    # Example: Subscribe to a specific price feed (replace with actual Pyth product/feed IDs)
    # These would typically come from your Sheets config
    # For testing, using a known ETH/USD price feed ID
    eth_usd_product_id = "Crypto.ETH/USD"
    eth_usd_price_feed_id = "0xff61499b922141c210e53406972d6d486e9b1776f79446415777051877475752"

    if connector.is_connected:
        await connector.subscribe_price_feed(eth_usd_product_id, eth_usd_price_feed_id)
        print(f"Subscribed to {eth_usd_product_id}")
    else:
        print("PythConnector not connected, cannot subscribe.")

    # Keep the main task running to receive updates for a short period
    print("Listening for price updates for 15 seconds...")
    await asyncio.sleep(15)

    if connector.is_connected:
        await connector.unsubscribe_price_feed(eth_usd_product_id)
        print(f"Unsubscribed from {eth_usd_product_id}")

    connection_task.cancel() # Stop the background connection task
    try:
        await connection_task
    except asyncio.CancelledError:
        print("Pyth connection task cancelled.")

    print("PythConnector test complete.")
    if price_updates:
        print(f"Received {len(price_updates)} price updates.")
    else:
        print("No price updates received.")

if __name__ == "__main__":
    asyncio.run(main())
