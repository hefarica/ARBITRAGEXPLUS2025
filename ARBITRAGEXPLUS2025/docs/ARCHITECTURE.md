# Architecture Overview

The system is composed of several loosely coupled services:

- **API Server (TypeScript)**: Exposes REST endpoints and orchestrates calls to other services (Rust engine, blockchain client, Python workers, Sheets). Implemented with Fastify for high performance and low overhead.
- **Blockchain Service (TypeScript)**: Encapsulates all interactions with EVM-compatible blockchains. Uses viem/ethers to read balances, positions, and execute transactions on the deployed smart contracts in the `contracts/` module.
- **Rust Engine**: Calculates optimal trading routes, risk metrics, and makes pricing decisions. Exposed through an HTTP or gRPC API for consumption by the API server and executor.
- **Executor (TypeScript)**: Runs workers that consume jobs from queues, perform simulations via the Rust engine, and submit transactions through the blockchain service. Supports scheduling and retry logic.
- **Python Collector**: Ingests data from oracles, CEX/DEX APIs, and other off-chain sources. Publishes normalized data to queues or persists to databases. Includes optional integration with Google Sheets for reporting.
- **Smart Contracts**: Solidity contracts that execute arbitrage trades, manage asset custody, and enforce risk limits. Deployed on supported chains (e.g., Ethereum, Polygon, BSC).
- **CI/CD and Guards**: A set of scripts and GitHub workflows that validate the repository structure, environment configuration, and health endpoints before allowing deployment.

See `docs/DATAFLOW.md` for more on how information flows through the system.
