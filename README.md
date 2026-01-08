<div align="center">
  <h1>MyceliumSDK</h1>
  <p><strong>The open-source SDK for simple DeFi integration</strong></p>
  <p>Create your own products without worry about DeFi and Web3 complexity</p>
</div>

<div align="center">
  <a href="https://www.npmjs.com/package/@mycelium-sdk/core"><img src="https://img.shields.io/npm/v/@mycelium-sdk/core?style=for-the-badge" alt="NPM Version"></a>
  <a href="https://docs.mycelium.sh/"><img src="https://img.shields.io/badge/Documentation-Read%20Docs-blue?style=for-the-badge" alt="Documentation"></a>
  <a href="https://github.com/MyceliumSDK/mycelium-sdk/blob/main/LICENSE"><img src="https://img.shields.io/badge/LICENSE-READ it-orange?style=for-the-badge" alt="License"></a>
  <a href="https://github.com/MyceliumSDK/mycelium-sdk/actions/workflows/monorepo-ci.yml"><img src="https://img.shields.io/github/actions/workflow/status/MyceliumSDK/mycelium-sdk/monorepo-ci.yml?branch=main&style=for-the-badge" alt="CI Status"></a>
</div>

# What is MyceliumSDK?

A TypeScript-based monorepo that contains:

- SDK to access yield opportunities using abstract high-level methods
- Services for local development and testing the SDK

To get more about the Mycelium SDK itself, check [the SDK README.md file](https://github.com/MyceliumSDK/mycelium-sdk/blob/main/packages/sdk/README.md)

## Project structure

This monorepo is organized into three main packages:

- **[packages/sdk](https://github.com/MyceliumSDK/mycelium-sdk/blob/main/packages/sdk)** - source code of Mycelium SDK
- **[packages/cli](https://github.com/MyceliumSDK/mycelium-sdk/blob/main/packages/cli)** - command-line interface for interacting with the Mycelium SDK
- **[packages/blockchain](https://github.com/MyceliumSDK/mycelium-sdk/blob/main/packages/blockchain)** - local blockchain service with faucet functionality and an ability to access fork RPC and Bundler (Alto). Can be used with `packages/cli`

> !IMPORTANT: SDK can be used via [npm registry](https://www.npmjs.com/package/@mycelium-sdk/core?activeTab=readme), the repo contains purely the source code and additional services (`cli` and `blockchain`) for further development

For each separate installation guide, please check each package separately:

- [packages/sdk](https://github.com/MyceliumSDK/mycelium-sdk/blob/main/packages/sdk/README.md)
- [packages/cli](https://github.com/MyceliumSDK/mycelium-sdk/blob/main/packages/clie/README.md)
- [packages/blockchain](https://github.com/MyceliumSDK/mycelium-sdk/blob/main/packages/blockchain/README.md)

## Prerequisites

- **pnpm** >= 10.9.0
- **node** >= 22.11.0

## Local development

For local development, please take a look at separate projects README.md files:

- Core SDK code for the contribution is in [packages/sdk](https://github.com/MyceliumSDK/mycelium-sdk/blob/main/packages/sdk/README.md)
- Command line interface for testing the SDK is in [packages/cli](https://github.com/MyceliumSDK/mycelium-sdk/blob/main/packages/clie/README.md)
- Additional faucet service for work with fork and SDK is in [packages/blockchain](https://github.com/MyceliumSDK/mycelium-sdk/blob/main/packages/blockchain/README.md)

## Contributing

Check the [CONTRIBUTION.md](https://github.com/0xdeval/mycelium-sdk/blob/main/CONTRIBUTION.md)

## License

This project is licensed under the dual license - Apache 2.0 + Commercial - see the [LICENSE](https://github.com/0xdeval/mycelium-sdk/blob/main/LICENSE)
