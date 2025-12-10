# UPD 10.12: OUTDATED AND NOT SUPPORTED SO FAR

Check more relevant SDK demo app in `./packages/cli`

## Mycelium app

The frontend package demonstrates SDK integration with a Next.js application featuring:

- Wallet creation and management
- Balance checking and vault operations
- Interactive UI built with Chakra UI
- Real-time blockchain interactions

## Requirements

1. pnpm >= 10.9.0
2. node >= 22.11.0
3. `packages/blockchain` service is running

## Installation

1. To install dependencies:

```bash
pnpm install
```

2. Copy `.env.example` to `.env` and set necessary variables

3. Make sure that Mycelium SDK is built in **[packages/sdk](https://github.com/0xdeval/mycelium-sdk/blob/main/packages/sdk)**

4. To run:

```bash
pnpm run dev
```

5. Open `localhost:3000`

## Environment variables

| Variable                                  | Description                                                                                                                                                                                                                                                                                             |
| ----------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `NEXT_PUBLIC_PRIVY_APP_ID`                | Privy wallet app id for embedded wallets. Check [Privy](https://www.privy.io/) to get the ID                                                                                                                                                                                                            |
| `NEXT_PUBLIC_PRIVY_APP_SECRET`            | Privy wallet app secret for embedded wallets. Check [Privy](https://www.privy.io/) to get the Secret                                                                                                                                                                                                    |
| `NEXT_PUBLIC_BUNDLER_URL`                 | Bundler URL for AA account. Check bundler section on [the `packages/blockchain` README.md](https://github.com/0xdeval/mycelium-sdk/blob/main/packages/blockchain/README.md)                                                                                                                             |
| `NEXT_PUBLIC_BLOCKCHAIN_SERVICE_HOSTNAME` | Optional and necessary only if deploy on Vercel. The `packages/blockchain` service URL. By default http://localhost:3001 for development. In case of publishing to Vercel, use here a public URL instead of localhost. Check more on how to deploy the service on the "Vercel deployment" section below |
| `NEXT_PUBLIC_CHAIN_ID`                    | The chain that will be used by Mycelium SDK. 8453 by default                                                                                                                                                                                                                                            |
| `NEXT_PUBLIC_RPC_URL`                     | The RPC that will be used by Mycelium SDK. Use Base mainnet public RPC by default                                                                                                                                                                                                                       |
| `NEXT_PUBLIC_BUNDLER_URL`                 | The user operations bundler that will be used by Mycelium SDK. Use Alto public bundler for Base chain by default                                                                                                                                                                                        |

## Vercel deployment

To deploy a demo frontend on Vercel with a local network you need to:

1. Have a running public Anvil Fork that can be accessed from web. Check [the `packages/blockchain` README.md](https://github.com/0xdeval/mycelium-sdk/blob/main/packages/blockchain/README.md) for more context about Anvil Fork
2. Have a running public Bundler that can be accessed from web. Check [the `packages/blockchain` README.md](https://github.com/0xdeval/mycelium-sdk/blob/main/packages/blockchain/README.md) for more context about Alto Bundler
3. Have a running blockchain service from `packages/blockchain` that can be accessed from web

Right after all 3 components are available you can deploy `packages/frontend`:

- Install vercel: `pnpm install -g vercel`
- Make sure your on root folder
- Deploy frontend: `pnpm run deploy`
- On Vercel "Build and Deployment" settings set the following "Root Directory" - `packages/frontend`
