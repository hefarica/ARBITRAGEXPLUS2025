# Data Flows

1. **Collect Ingest → Queue → Executor → Contracts**:
   - Python jobs pull prices, liquidity, and risk data from on-chain or off-chain sources and push them to a queue (e.g. Redis, Kafka).
   - The TypeScript Executor consumes jobs, queries the Rust engine for optimal strategies, and instructs the Blockchain Service to execute smart contract calls.

2. **API Requests → Engine / Executor → Contracts**:
   - Users interact with the HTTP API for quotes, account information, or to place arbitrage orders.
   - The API delegates heavy computations to the Rust engine or dispatches jobs to the Executor as needed.

3. **Sheets Integration ↔ API/Collector**:
   - The Python collector and API server can read from and write to Google Sheets for reporting, limit configuration, and human-friendly dashboards.
