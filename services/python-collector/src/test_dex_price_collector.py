import os
import sys
import asyncio
from dotenv import load_dotenv

# Add the src directory to the Python path
sys.path.append(os.path.join(os.path.dirname(__file__), 'utils'))
sys.path.append(os.path.join(os.path.dirname(__file__), 'collectors'))

from sheets_client import SheetsClient
from dex_prices import DexPriceCollector

# Load environment variables from .env file
dotenv_path = os.path.abspath(os.path.join(os.path.dirname(__file__), '../../../.env'))
print(f"Attempting to load .env from: {dotenv_path}")
load_dotenv(dotenv_path=dotenv_path)

SPREADSHEET_ID = os.getenv('GOOGLE_SHEETS_DOC_ID')
DEX_ARRAY_SHEET = os.getenv('DEX_ARRAY_SHEET')

print(f"GOOGLE_SHEETS_DOC_ID after getenv: {SPREADSHEET_ID}")
print(f"DEX_ARRAY_SHEET after getenv: {DEX_ARRAY_SHEET}")

if not SPREADSHEET_ID or not DEX_ARRAY_SHEET:
    print("Error: GOOGLE_SHEETS_DOC_ID or DEX_ARRAY_SHEET not found in .env")
    sys.exit(1)

async def main():
    try:
        sheets_client = SheetsClient(SPREADSHEET_ID)
        print(f"Successfully initialized SheetsClient for spreadsheet ID: {SPREADSHEET_ID}")

        # Ensure the DEX_ARRAY_SHEET exists for testing purposes
        if not sheets_client.ensure_sheet_exists(DEX_ARRAY_SHEET):
            print(f"Failed to ensure sheet \'{DEX_ARRAY_SHEET}\' exists. Please create it manually or check permissions.")
            sys.exit(1)

        # Write dummy DEX config to the sheet for testing
        dummy_dex_config = [
            ["NAME", "ENDPOINT", "PAIRS"],
            ["Uniswap", "https://api.uniswap.org", "ETH-USDT,WBTC-ETH"],
            ["PancakeSwap", "https://api.pancakeswap.finance", "BNB-BUSD"]
        ]
        write_result = sheets_client.write_values(f'{DEX_ARRAY_SHEET}!A1', dummy_dex_config)
        if write_result:
            print(f"Successfully wrote dummy DEX config to {DEX_ARRAY_SHEET}")
        else:
            print(f"Failed to write dummy DEX config to {DEX_ARRAY_SHEET}")
            sys.exit(1)

        config = {"DEX_ARRAY_SHEET": DEX_ARRAY_SHEET}
        collector = DexPriceCollector(sheets_client, config)
        print("Initialized DexPriceCollector.")

        await collector.collect_prices()

        print("\n--- Cached Prices ---")
        print("Uniswap ETH-USDT price:", collector.get_cached_price("Uniswap", "ETH-USDT"))
        print("Uniswap WBTC-ETH price:", collector.get_cached_price("Uniswap", "WBTC-ETH"))
        print("PancakeSwap BNB-BUSD price:", collector.get_cached_price("PancakeSwap", "BNB-BUSD"))

    except Exception as e:
        print(f"An error occurred: {e}")
        sys.exit(1)

if __name__ == "__main__":
    asyncio.run(main())
