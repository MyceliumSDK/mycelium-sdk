---
'@mycelium-sdk/core': major
---

## What was changed?

1. Added paymaster to ProxyProtocol to use with DeFi opportunities with Mycelium Cloud
2. Updated tests for ProxyProtocol
3. Added Paymaster support for DefaultSmartWallet
4. Updated tests for DefaultSmartWallet.ts
5. Added paymaster to SparkProtocol to use with Spark vaults
6. Updated SparkProtocol tests

## Why was changed/added?

1. Support usage of paymaster with DeFi opportunities from Mycelium Cloud
2. Supported usage of paymaster with DeFi opportunities with core SDK without Mycelium Cloud

## How to use the change?

- Pass the paymaster token to earn() and withdraw() methods of a wallet
- Pass the paymaster token to send() and sendBatch() methods of a wallet
