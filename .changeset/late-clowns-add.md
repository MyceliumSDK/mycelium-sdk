---
'@mycelium-sdk/core': major
---

## What was changed?

- Added paymaster to ProxyProtocol to use with DeFi opportunities with Mycelium Cloud
- Updated tests for ProxyProtocol
- Added Paymaster support for DefaultSmartWallet
- Updated tests for DefaultSmartWallet.ts
- Added paymaster to SparkProtocol to use with Spark vaults
- Updated SparkProtocol tests

## Why was changed/added?

- Support usage of paymaster with DeFi opportunities from Mycelium Cloud
- Supported usage of paymaster with DeFi opportunities with core SDK without Mycelium Cloud

## How to use the change?

- Pass the paymaster token to earn() and withdraw() methods of a wallet
- Pass the paymaster token to send() and sendBatch() methods of a wallet
