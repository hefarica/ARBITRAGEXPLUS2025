#!/usr/bin/env bash
# Check that all required environment variables are set
vars=(PORT CHAIN_IDS ETH_RPC_URL POLYGON_RPC_URL BSC_RPC_URL WALLET_PRIVATE_KEY ENGINE_RPC_URL GOOGLE_PROJECT_ID GOOGLE_CLIENT_EMAIL GOOGLE_PRIVATE_KEY SHEETS_PNL_SPREADSHEET_ID SHEETS_LIMITS_SPREADSHEET_ID)
for v in "${vars[@]}"; do
  if [ -z "${!v}" ]; then
    echo "Missing variable $v"
    exit 1
  fi
done
echo "Environment looks good"
