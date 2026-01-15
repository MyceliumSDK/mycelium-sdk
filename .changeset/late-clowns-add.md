---
'@mycelium-sdk/core': major
---

## What was changed?

1. Added paymaster to ProxyProtocol to use with DeFi opportunities with Mycelium Cloud
2. Updated tests for ProxyProtocol
3. Added Paymaster support for DefaultSmartWallet
4. Updated tests for DefaultSmartWallet.ts

## Why was changed/added?

1. Support usage of paymaster with DeFi opportunities from Mycelium Cloud

## How to use the change?

Pass the paymaster token to earn() and withdraw() methods of a wallet
