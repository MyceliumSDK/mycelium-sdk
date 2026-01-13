---
'@mycelium-sdk/core': major
---

## What was changed?

- Supported Pimlico paymaster in SDK for support gas using ERC-20 tokens
- Supported paymaster for send and sendBatch SDK methods

## Why was changed/added?

- Support smoother user experience with smart wallet

## How to use the change?

For self-hosted version:

- Use `PAYMASTER_URL` env variable to pass the paymaster URL to SDK on the init step
- Currently only the PImlico paymaster is supported
- Currently only gas sponsoring with ERC-20 tokens is supported

More details:

- README.md
- https://docs.blockscout.com
