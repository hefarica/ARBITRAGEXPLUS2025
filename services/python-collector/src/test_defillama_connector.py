import os
import sys
import asyncio
from dotenv import load_dotenv

# Add the src directory to the Python path
sys.path.append(os.path.join(os.path.dirname(__file__), 'connectors'))

from defillama import DefiLlamaConnector

# Load environment variables from .env file
dotenv_path = os.path.abspath(os.path.join(os.path.dirname(__file__), '../../../.env'))
print(f"Attempting to load .env from: {dotenv_path}")
load_dotenv(dotenv_path=dotenv_path)

DEFILLAMA_API = os.getenv('DEFILLAMA_API')

print(f"DEFILLAMA_API after getenv: {DEFILLAMA_API}")

if not DEFILLAMA_API:
    print("Error: DEFILLAMA_API not found in .env")
    sys.exit(1)

async def main():
    print("Starting DefiLlamaConnector test...")
    connector = DefiLlamaConnector(base_url=DEFILLAMA_API)

    print("Fetching all protocols...")
    protocols = await connector.get_protocols()
    if protocols:
        print(f"Found {len(protocols)} protocols. First 3: {protocols[:3]}")
    else:
        print("No protocols found or error fetching protocols.")

    print("\nFetching TVL for Uniswap...")
    uniswap_tvl = await connector.get_protocol_tvl("uniswap")
    if uniswap_tvl:
        print(f"Uniswap TVL: {uniswap_tvl.get('tvl', 'N/A')}")
    else:
        print("No TVL found for Uniswap or error fetching TVL.")

    print("\nFetching historical TVL chart for Aave...")
    aave_charts = await connector.get_charts_tvl("aave")
    if aave_charts:
        print(f"Aave historical TVL data points: {len(aave_charts.get('tvl', []))}")
    else:
        print("No historical TVL data found for Aave or error fetching data.")

    print("DefiLlamaConnector test complete.")

if __name__ == "__main__":
    asyncio.run(main())
