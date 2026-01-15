# @mycelium-sdk/core

## 2.0.0-alpha.1

### Major Changes

- ## What was changed?
  1. Added paymaster to ProxyProtocol to use with DeFi opportunities with Mycelium Cloud
  2. Updated tests for ProxyProtocol
  3. Added Paymaster support for DefaultSmartWallet
  4. Updated tests for DefaultSmartWallet.ts

  ## Why was changed/added?
  1. Support usage of paymaster with DeFi opportunities from Mycelium Cloud

  ## How to use the change?

  Pass the paymaster token to earn() and withdraw() methods of a wallet

## 2.0.0-alpha.0

### Major Changes

- 39daed2: ## What was changed?
  - Removed redundant links from SDK README, LICENSE, and CONTRIBUTION
  - Changed SDK README description

  ## Why was changed/added?

  To keep everything up-dated

  ## How to use the change?

  No necessary actions are required

- 2030d68: ## What was changed?
  - Supported Pimlico paymaster in SDK for support gas using ERC-20 tokens
  - Supported paymaster for send and sendBatch SDK methods

  ## Why was changed/added?
  - Support smoother user experience with smart wallet

  ## How to use the change?

  For self-hosted version:
  - Use `PAYMASTER_URL` env variable to pass the paymaster URL to SDK on the init step
  - Currently only the Pimlico paymaster is supported
  - Currently only gas sponsoring with ERC-20 tokens is supported

  More details:
  - README.md
  - https://docs.blockscout.com

## 1.0.0

### Major Changes

- 12684f3: 1. Integrated a ProxyProtocol class to interact with a backend for a cloud version 2. Added a support of a cloud version through API keys. Currently in Beta 3. Changed the SDK initializing 4. Changed the response format for SDK methods, including for protocols
- ad7a837: 1. Removed redundant methods for a WalletNamespace 2. Moved `getTopUpConfig()` and `getCashOutConfig()` methods to a separate `FundingNamespace` 3. Change public methods for creating a smart wallet with an embedded signer under the hood in `WalletNamespace`:
  - Was: `createWalletWithEmbeddedSigner()` and `getSmartWalletWithEmbeddedSigner()`
  - Become: `createAccount()` and `getAccount()`
  4. Edited all related tests
  5. Updated all related docs
  6. Rename a public type `RampConfigResponse` to `FundingOptionsResponse`

### Patch Changes

- 49956ab: 1. Change Mycelium cloud URL hostname to a correct one

## 1.0.0-alpha.2

### Patch Changes

- 1. Change Mycelium cloud URL hostname to a correct one

## 1.0.0-alpha.1

### Major Changes

- 12684f3: 1. Integrated a ProxyProtocol class to interact with a backend for a cloud version 2. Added a support of a cloud version through API keys. Currently in Beta 3. Changed the SDK initializing 4. Changed the response format for SDK methods, including for protocols

## 1.0.0-alpha.0

### Major Changes

- ad7a837: 1. Removed redundant methods for a WalletNamespace 2. Moved `getTopUpConfig()` and `getCashOutConfig()` methods to a separate `FundingNamespace` 3. Change public methods for creating a smart wallet with an embedded signer under the hood in `WalletNamespace`:
  - Was: `createWalletWithEmbeddedSigner()` and `getSmartWalletWithEmbeddedSigner()`
  - Become: `createAccount()` and `getAccount()`
  4. Edited all related tests
  5. Updated all related docs
  6. Rename a public type `RampConfigResponse` to `FundingOptionsResponse`

## 0.1.0

### Minor Changes

- 41fa11d: Integrated CoinbaseCDP to provide on and off-ramp functionalities inside SDK. New topUp and cashOut methods are added to DefaultSmartWallet class. Also 2 new methods are added on the top SDK level to fetch on-ramp and off-ramp options. DefaultSmartWallet class was reviewed, documentation for several methods were updated
