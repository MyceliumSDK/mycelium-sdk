---
'@mycelium-sdk/core': major
---

## What was changed?

- Added additional confirmation of a transaction for `send()` adn `sendBatch()` methods via RPC request using wait `waitForTransactionReceipt` method

## Why was changed/added?

- Bundler sometimes go ahead in state that RPC node. It cause an issue when RPC try to fetch a wallet balance, but got zero result as a node still work with an old block

## How to use the change?

- It will be used by default under the hood for `send()` and `sendBatch()` methods of the SDK
