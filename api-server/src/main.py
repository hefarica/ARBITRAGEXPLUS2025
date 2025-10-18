"""
============================================================================
ARCHIVO: ./api-server/src/main.py
============================================================================

📥 ENTRADA DE DATOS:

🔄 TRANSFORMACIÓN:
  FUNCIONES: start_collectors, get_dex_prices, run_collectors_in_background

📤 SALIDA DE DATOS:

🔗 DEPENDENCIAS:
  - SocketIO
  - load_dotenv
  - dotenv

============================================================================
"""

import os
import sys
# DON'T CHANGE THIS !!!
sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

from flask import Flask, send_from_directory, jsonify
from flask_socketio import SocketIO, emit

import asyncio
from threading import Thread

# Import collectors
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..', 'services', 'python-collector', 'src')))
from utils.sheets_client import SheetsClient
from collectors.dex_prices import DexPriceCollector
from connectors.pyth import PythConnector

# Load environment variables
from dotenv import load_dotenv
load_dotenv(dotenv_path=os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..', '.env')))

app = Flask(__name__, static_folder=os.path.join(os.path.dirname(__file__), 'static'))
socketio = SocketIO(app, cors_allowed_origins="*") # Allow all origins for simplicity during development
app.config['SECRET_KEY'] = 'asdf#FGSgvasgf$5$WGT'

@app.route('/api/prices/dex', methods=['GET'])
def get_dex_prices():
    return jsonify(dex_collector.price_cache)

@app.route('/', defaults={'path': ''})
@app.route('/<path:path>')
def serve(path):
    static_folder_path = app.static_folder
    if static_folder_path is None:
            return "Static folder not configured", 404

    if path != "" and os.path.exists(os.path.join(static_folder_path, path)):
        return send_from_directory(static_folder_path, path)
    else:
        index_path = os.path.join(static_folder_path, 'index.html')
        if os.path.exists(index_path):
            return send_from_directory(static_folder_path, 'index.html')
        else:
            return "index.html not found", 404

DEX_ARRAY_SHEET = os.getenv('DEX_ARRAY_SHEET')
GOOGLE_SHEETS_DOC_ID = os.getenv('GOOGLE_SHEETS_DOC_ID')
PYTH_ENDPOINT = os.getenv('PYTH_ENDPOINT')

if not all([DEX_ARRAY_SHEET, GOOGLE_SHEETS_DOC_ID, PYTH_ENDPOINT]):
    print("Error: Missing environment variables for collectors.")
    sys.exit(1)

# Initialize SheetsClient
sheets_client = SheetsClient(GOOGLE_SHEETS_DOC_ID)

# Initialize collectors
dex_collector = DexPriceCollector(sheets_client, {})

def pyth_price_update_handler(product_id: str, price: float, conf: int):
    print(f"Pyth Price Update (API Server): Product ID={product_id}, Price={price}, Confidence={conf}")
    socketio.emit("pyth_price_update", {"product_id": product_id, "price": price, "conf": conf})

pyth_connector = PythConnector(PYTH_ENDPOINT, pyth_price_update_handler)

async def start_collectors():
    print("Starting background collectors...")
    # Ensure DEXES sheet exists and has dummy data for testing
    if not sheets_client.ensure_sheet_exists(DEX_ARRAY_SHEET):
        print(f"Failed to ensure sheet '{DEX_ARRAY_SHEET}' exists. Please create it manually or check permissions.")
        sys.exit(1)
    dummy_dex_config = [
        ["NAME", "ENDPOINT", "PAIRS"],
        ["Uniswap", "https://api.uniswap.org", "ETH-USDT,WBTC-ETH"],
        ["PancakeSwap", "https://api.pancakeswap.finance", "BNB-BUSD"]
    ]
    sheets_client.write_values(f'{DEX_ARRAY_SHEET}!A1', dummy_dex_config)
    print(f"Wrote dummy DEX config to {DEX_ARRAY_SHEET}")

    await asyncio.gather(
        dex_collector.collect_prices(),
        pyth_connector.connect()
    )

def run_collectors_in_background():
    loop = asyncio.new_event_loop()
    asyncio.set_event_loop(loop)
    loop.run_until_complete(start_collectors())

collector_thread = Thread(target=run_collectors_in_background)
collector_thread.daemon = True
collector_thread.start()

@socketio.on('connect')
def handle_connect():
    print('Client connected to WebSocket!')
    emit('server_response', {'data': 'Connected to API server WebSocket!'})

if __name__ == '__main__':
    socketio.run(app, host='0.0.0.0', port=5000, debug=True, allow_unsafe_werkzeug=True, use_reloader=False)

