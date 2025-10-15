
import asyncio
import websockets
import json
import time
from typing import Dict, Any, Callable

class PythConnector:
    def __init__(self, websocket_url: str, on_price_update: Callable[[str, float, int], None]):
        self.websocket_url = websocket_url
        self.on_price_update = on_price_update
        self.connection = None
        self.is_connected = False
        self.price_feeds: Dict[str, str] = {}

    async def connect(self):
        while True:
            try:
                print(f"Connecting to Pyth WebSocket at {self.websocket_url}...")
                async with websockets.connect(self.websocket_url) as ws:
                    self.connection = ws
                    self.is_connected = True
                    print("Connected to Pyth WebSocket.")
                    await self._listen_for_messages()
            except websockets.exceptions.ConnectionClosedOK:
                print("Pyth WebSocket connection closed gracefully. Reconnecting...")
            except Exception as e:
                print(f"Pyth WebSocket error: {e}. Reconnecting in 5 seconds...")
            self.is_connected = False
            await asyncio.sleep(5) # Reconnect after a delay

    async def _listen_for_messages(self):
        try:
            async for message in self.connection:
                data = json.loads(message)
                self._process_message(data)
        except Exception as e:
            print(f"Error listening for Pyth messages: {e}")

    def _process_message(self, data: Dict[str, Any]):
        if data.get("type") == "price_update":
            product_id = data["product_id"]
            price = float(data["price"]["price"])
            conf = int(data["price"]["conf"])
            # Normalize feed to internal schema if necessary
            self.on_price_update(product_id, price, conf)
        # Add more message types handling as needed

    async def subscribe_price_feed(self, product_id: str, price_feed_id: str):
        self.price_feeds[product_id] = price_feed_id
        if self.is_connected:
            subscribe_message = {
                "jsonrpc": "2.0",
                "id": 1,
                "method": "subscribe",
                "params": [
                    price_feed_id
                ]
            }
            await self.connection.send(json.dumps(subscribe_message))
            print(f"Subscribed to Pyth price feed: {product_id} ({price_feed_id})")

    async def unsubscribe_price_feed(self, product_id: str):
        price_feed_id = self.price_feeds.pop(product_id, None)
        if price_feed_id and self.is_connected:
            unsubscribe_message = {
                "jsonrpc": "2.0",
                "id": 1,
                "method": "unsubscribe",
                "params": [
                    price_feed_id
                ]
            }
            await self.connection.send(json.dumps(unsubscribe_message))
            print(f"Unsubscribed from Pyth price feed: {product_id}")

# Example Usage (for local testing)
# async def main():
#     PYTH_WS_URL = "wss://hermes.pyth.network/v1/ws"

#     def handle_price_update(product_id: str, price: float, conf: int):
#         print(f"Pyth Price Update: Product ID={product_id}, Price={price}, Confidence={conf}")

#     connector = PythConnector(PYTH_WS_URL, handle_price_update)
#     # Start connection in a background task
#     asyncio.create_task(connector.connect())

#     # Give some time for connection to establish
#     await asyncio.sleep(2)

#     # Example: Subscribe to a specific price feed (replace with actual Pyth product/feed IDs)
#     # You would typically get these from your Sheets config
#     await connector.subscribe_price_feed("Crypto.ETH/USD", "0xff61499b922141c210e53406972d6d486e9b1776f79446415777051877475752")

#     # Keep the main task running to receive updates
#     await asyncio.sleep(60) # Listen for 60 seconds

# if __name__ == "__main__":
#     asyncio.run(main())

