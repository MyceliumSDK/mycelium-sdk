<div align="center">
  <h1>MyceliumSDK</h1>
  <p><strong>The open-source SDK for simple DeFi integration</strong></p>
  <p>Create your own products without worry about DeFi and Web3 complexity</p>
</div>

<div align="center">
  <a href="https://github.com/0xdeval/mycelium-sdk/blob/main/LICENSE"><img src="https://img.shields.io/github/license/0xdeval/mycelium-sdk?style=for-the-badge" alt="License"></a>
  <a href="https://www.npmjs.com/package/@mycelium-sdk/core"><img src="https://img.shields.io/npm/v/@mycelium-sdk/core?style=for-the-badge" alt="NPM Version"></a>
  <a href="https://docs.mycelium.sh/"><img src="https://img.shields.io/badge/Documentation-Read%20Docs-blue?style=for-the-badge" alt="Documentation"></a>
  <a href="https://github.com/0xdeval/mycelium-sdk/actions/workflows/monorepo-ci.yml"><img src="https://img.shields.io/github/actions/workflow/status/0xdeval/mycelium-sdk/monorepo-ci.yml?branch=main&style=for-the-badge" alt="CI Status"></a>
</div>

# What is MyceliumSDK?

A TypeScript-based monorepo that contains:

- SDK to access yield opportunities using abstract high-level methods
- Services for local development and testing the SDK

To get more about the Mycelium SDK itself, check [the SDK README.md file](https://github.com/0xdeval/mycelium-sdk/blob/main/packages/sdk/README.md)

## Project structure

This monorepo is organized into three main packages:

- **[packages/sdk](https://github.com/0xdeval/mycelium-sdk/blob/main/packages/sdk)** - Core TypeScript Mycelium SDK
- **[packages/frontend](https://github.com/0xdeval/mycelium-sdk/blob/main/packages/frontend)** - Mycelium app - Next.js demo application showcasing SDK capabilities
- **[packages/blockchain](https://github.com/0xdeval/mycelium-sdk/blob/main/packages/blockchain)** - Local blockchain service with faucet functionality and an ability to access fork RPC and Bundler (Alto). Used with `packages/frontend` for a local development and testing

> !IMPORTANT: SDK is the key component that can work without 2 other components: `packages/frontend` and `packages/blockchain`. Both components are used purely for the local development

For each separate installation guide, please check each package separately:

- [packages/sdk](https://github.com/0xdeval/mycelium-sdk/blob/main/packages/sdk/README.md)
- [packages/frontend](https://github.com/0xdeval/mycelium-sdk/blob/main/packages/frontend/README.md)
- [packages/blockchain](https://github.com/0xdeval/mycelium-sdk/blob/main/packages/blockchain/README.md)

## Prerequisites

- **pnpm** >= 10.9.0
- **node** >= 22.11.0
- **TypeScript** >= 5.0.0
- **Anvil** >= 1.2.3 (for blockchain package)

## Installation

Install all dependencies across the monorepo:

```bash
pnpm install
```

## Development with Turbo

This project uses [Turbo](https://turbo.build/), so to start all services locally, just use:

```bash
# Instal deps
pnpm install

# Run all services
pnpm run dev
```

It'll build SDK and run both packages: `packages/frontend` and `packages/blockchain`
Frontend is available on `http://localhost:3000`
Blockchain service API is available on `http://localhost:3001`

## Contributing

Check the [CONTRIBUTION.md](https://github.com/0xdeval/mycelium-sdk/blob/main/CONTRIBUTION.md)

## License

This project is licensed under the dual license - Apache 2.0 + Commercial - see the [LICENSE](https://github.com/0xdeval/mycelium-sdk/blob/main/LICENSE)
