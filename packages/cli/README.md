# Mycelium SDK CLI

A simple command-line interface for interacting with the Mycelium SDK. Manage your wallets, explore DeFi vaults, and handle deposits and withdrawals all from your terminal

## What is it?

The Mycelium CLI is an interactive tool that lets you:

- Create and manage smart wallet using Mycelium SDK
- Browse available DeFi opportunities
- Deposit funds into vaults to earn yields
- Withdraw your earnings
- Check your wallet and earning balances

## Getting Started

### Prerequisites

- Node.js or Bun installed
- All configured envs on `.env` file (API key is in beta right now)

### Setup

1. Install dependencies:sh
   `pnpm install`

2. Create a `.env` file with your configuration:

3. Make sure you run a blockchain service in `packages/blockchain` to have access to a faucet

4. Run the CLI:

   `pnpm start`

## Usage

Once started, the CLI will display a menu with the following options:

1. **Create account** - Create a new wallet with your email
2. **Login to account** - Access an existing wallet
3. **Get best vaults** - View recommended DeFi vaults
4. **View wallet details** - Check your wallet address and token balances
5. **Get earning balances** - See your current deposits in vaults
6. **Top up from faucet** - Get test tokens in case you're running a fork with faucet service in `packages/blockchain`
7. **Deposit to vault** - Deposit funds into a DeFi vault
8. **Withdraw from vault** - Withdraw your funds from a vault

Simply select a number to perform an action. The CLI will guide you through each step with prompts.

## Notes

- This is a development tool for testing and interacting with the Mycelium SDK
- Make sure you're using test networks and test tokens when developing
- Wallet data is stored locally in your project directory
