# MyceliumSDK

> Check documentation: https://docs.mycelium.sh

A TypeScript-based SDK that implements wallet management via ERC-4337 smart account and access to crypto yield opportunities though integrated protocols under the hood. The SDK allows integrators to easily onboard users, manage wallets, and interact with DeFi protocols

# Core features

The Mycelium SDK simplifies on-chain interactions by creating and managing a smart wallet with an embedded wallet as a signer for blockchain related operations. Smart wallet as well as embedded wallet signer are non-custodial and only a user has a direct access to it. The embedded wallet management is delegated to [the Privy platform](https://www.privy.io/)

SDK has the following core features:

1. Create a smart wallet with embedded OR external wallet as a signer
2. Smart wallet core features: send/receive funds, sign transaction/message
3. Fetch crypto yield opportunities
4. Deposit or withdraw funds to/from a particular yield opportunity
5. Fetch information about yield and balance for a specific opportunity where funds are
6. Fund wallet via Coinbase: Generates a top-up link for the user to deposit funds

An integrator can define basic settings for yield opportunities that will be recommended to a end user through SDK. More about this you can find on the `Protocol security config` section

# Versions

Mycelium SDK is an open-source and publicly available to anyone for the usage. Despite this, there are 2 versions of Mycelium SDK that can be used by an integrator:

1. **Self-hosted**
   Clone the underlying repository, provide all necessary settings for providers that are used under the hood (Privy, Coinbase, etc). Right after this, you can use an integrated to a self hosted SDK version protocol - Spark. For more protocols, you need to switch to the cloud version
2. **Cloud**
   This version covers everything for an integrator. You just use the API key that will be provided to you and that's all. All settings and expenses for 3d party providers Mycelium SDK will take on it. For more information, check the `Cloud version` section

## Self-hosted version

Self hosted version is available out of this repo and can be used by anyone by cloning the repo and settings up all necessary and required SDK parameters. Self hosted version has only one integrated protocol that can be used for yield opportunities recommendations - Spark. To start working with a self hosted SDK version, please refer to the `Get started` section

## Cloud version

Cloud version is a paid (current free) version of the SDK, when everything is handled under the hood for an integrator. The only thing that you need to pass to the SDK during the initialization is an API key. All further 3d party platforms integrations will be handled under the hood by Mycelium. To start working with a self hosted SDK version, please refer to the `Get started` section

# Get started

Both cloud and self hosted version are required the following prerequisites:

1. pnpm >= 10.9.0
2. node >= 22.11.0
3. TypeScript >= 5.0.0

## Environment variables

Both self hosted and cloud version are required some variables to be provided during the initialization of an SDK. The list of envs for cloud version is significant, than for a self hosted one. Here is the full list of variables:

| Variable Name                 | Description                                                                                        | Version             | Mandatory |
| ----------------------------- | -------------------------------------------------------------------------------------------------- | ------------------- | --------- |
| `PRIVY_APP_ID`                | Privy wallet app id for embedded wallets                                                           | Self-hosted         | Yes       |
| `PRIVY_APP_SECRET`            | Privy wallet app secret for embedded wallets                                                       | Self-hosted         | Yes       |
| `RPC_URL`                     | A RPC URL for a chain                                                                              | Self-hosted         | Yes       |
| `BUNDLER_URL`                 | A bundler URL to process User Operations                                                           | Self-hosted         | Yes       |
| `COINBASE_CDP_API_KEY_ID`     | Coinbase CDP Api Key ID for on/off ramp functionality                                              | Self-hosted         | No        |
| `COINBASE_CDP_API_KEY_SECRET` | Coinbase CDP Api secret for on/off ramp functionality                                              | Self-hosted         | No        |
| `INTEGRATOR_ID`               | Unique integrator ID to track SDK usage and enable 3rd party services (e.g., Coinbase off/on-ramp) | Self-hosted         | Yes       |
| `API_KEY`                     | API key to run SDK with managed settings                                                           | Cloud               | Yes       |
| `PROTOCOL_RISK_LEVEL`         | Risk level of protocol that will be used by an SDK in the configuration                            | Cloud & self-hosted | Yes       |
| `CHAIN_ID`                    | Chain ID to work with                                                                              | Cloud & self-hosted | Yes       |

## Self hosted

### Installation

1. Clone the repo:

```bash
git clone https://github.com/MyceliumSDK/mycelium-sdk.git
```

2. Go to `package/sdk` and install dependencies:

```bash
cd package/sdk && pnpm install
```

3. Build the SDK:

```bash
pnpm run build
```

> The built SDK can then be used in your application or imported as a local library

### Testing

To test the SDK you can use the build in CLI from the same repository:

1. Go to `packages/cli` and install dependencies

```bash
cd packages/cli && pnpm install
```

2. Setup the CLI settings based on the README.md file

3. Start the CLI

```bash
pnpm run start
```

> In case if you want to test the SDK with a fork, you need to use `anvil` and `packages/blockchain` service. Please refer to `packages/blockchain/README.md` for more details

### SDK initialization

In case of a self hosted version, you need to define all your env variables. For more details, please refer the `Environment variables` section above. Right after you define all env variables, you can initiate the SDK:

```typescript
this.sdk = new MyceliumSDK({
  walletsConfig: {
    embeddedWalletConfig: {
      provider: {
        type: 'privy',
        providerConfig: {
          appId: '...',
          appSecret: '...',
        },
      },
    },
    smartWalletConfig: {
      provider: {
        type: 'default',
      },
    },
  },
  chain: {
    chainId: '...',
    rpcUrl: '...',
    bundlerUrl: '...',
  },
  protocolsRouterConfig: {
    riskLevel: '...',
  },
  coinbaseCDPConfig: {
    apiKeyId: '...',
    apiKeySecret: '...',
  },
  integratorId: '...',
});
```

## Cloud version

If you decided to use a ready to use library, you need to receive an API key first. For this purpose, you can contact [Mike Krupin on Telegram](https://t.me/maikyman) or you can [send an email](emailto:myceliumsdk@gmail.com) to the Mycelium mailbox

Right after you would get an API key, you can start working with an SDK

### Installation

1. Install the library:

```bash
pnpm install @mycelium-sdk/core
```

2. You're ready to use and SDK!

### Testing

To test the SDK you can use the build in CLI from the repository:

1. Clone the repo:

```bash
git clone https://github.com/MyceliumSDK/mycelium-sdk.git
```

2. Go to `packages/cli` and install dependencies

```bash
cd packages/cli && pnpm install
```

3. Setup the CLI settings based on the README.md file

4. Instal the latest SDK version:

```bash
pnpm install @mycelium-sdk/core
```

5. Start the CLI

```bash
pnpm run start
```

> In case if you want to test the SDK with a fork, you need to use `anvil` and `packages/blockchain` service. Please refer to `packages/blockchain/README.md` for more details

### SDK initialization

```javascript
this.sdk = await MyceliumSDK.init({
  apiKey,
  chainId: '8453',
  protocolsSecurityConfig: {
    riskLevel: 'low',
  },
});
```

> To get more information about `protocolSecurityConfig` settings, please refer to the `Protocol security config` section below

# Protocol security config

Current config of settings used by `Protocol router` to define:

1. What protocols will be used by SDK
2. What savings vaults will be recommended by SDK

Currently, the following settings for the config are available:

- `riskLevel` define the risk level of a protocol that will be used by an integrator to recommend saving vaults
  Risk level is determined by the general popularity and reputation of the protocol within the crypto industry. No independent risk assessment is performed by the SDK to determine the risk level

# Integrated protocols

Currently, the following list of protocols is integrated into SDK and can be used by user in self-hosted and cloud versions:

| Protocol                    | Chain | ChainId | Protocol risk level | Available on             |
| --------------------------- | ----- | ------- | ------------------- | ------------------------ |
| [Spark](https://spark.fi/)  | Base  | 8453    | low                 | Self hosted version only |
| [Beefy](https://beefy.com/) | Base  | 8453    | low                 | Cloud version only       |

The protocol router mechanism of SDK select the best protocol based on your `protocolSecurityConfig` settings as well as on other provided settings. The only requirement from an integrator is to define a high-level settings for protocols, e.g. min APY, protocol risk level, etc

The SDK will use settings and find the best protocol and vault under the hood. No one, including integrator, will need to care about this part

More protocol and chains will be added soon

# Chain management

The chain configuration provided during SDK initialization defines where on-chain activities will take place. Currently, only one chain is supported for the `earn` functionality, with multi-chain support coming soon
The example configuration above uses Base chain (chain ID: 8453), meaning all protocol operations and vault deposits will occur on the Base network

# Local development

Install dependencies:

```bash
pnpm install
```

Build the SDK in watch mode:

```bash
pnpm run watch
```

Run tests:

```bash
pnpm run test
```

Run tests in watch mode:

```bash
pnpm run test:watch
```

# Documentation

The SDK should be documented and described with [TypeDoc rules](https://typedoc.org/). To get more context, check [CONTRIBUTION.md](https://github.com/0xdeval/mycelium-sdk/blob/main/CONTRIBUTION.md)

To generate documentation:

```bash
# Generate public documentation
pnpm run docs:public

# Generate development documentation
pnpm run docs:dev
```

# Contribution

Check the [CONTRIBUTION.md](https://github.com/0xdeval/mycelium-sdk/blob/main/CONTRIBUTION.md)

# License

This project is licensed under the dual license - Apache 2.0 + Commercial - see the [LICENSE](https://github.com/0xdeval/mycelium-sdk/blob/main/LICENSE)
