import * as readline from 'readline';
import {
  MyceliumSDK,
  type MyceliumSDKConfig,
  type ProxyBalance,
  type SmartWallet,
  type VaultBalance,
  type Vaults,
} from '@mycelium-sdk/core';
import { formatBalancesToDisplay, formatVaultInfoToDisplay, getEnv } from './utils/formatters';
import { WalletDatabase } from './libs/database';
import { getEnvsConfig } from './config';
import { isValidAmountFormat, printAvailableCliOptions } from './utils/cli-utils';
import { welcomeBanner } from './utils/ascii-banner';
import { logError, logResult, logState } from './utils/logger';

export class CLI {
  private rl: readline.Interface;
  private sdk: MyceliumSDK | null = null;
  private wallet: SmartWallet | null = null;
  private embeddedWalletId: string | null = null;

  private currentBestVaults: Vaults | null = null;

  private db: WalletDatabase;

  constructor() {
    this.rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });

    this.db = new WalletDatabase();
  }

  async start() {
    try {
      await this.initializeSDK();
      await welcomeBanner();
      await this.mainLoop();
    } catch (error) {
      logError('Critical Error during startup', error);
      this.rl.close();
    }
  }

  private async initializeSDK() {
    const apiKey = getEnv('API_KEY');

    if (apiKey) {
      logState('Initializing SDK with API key from environment...');
      this.sdk = await MyceliumSDK.init({
        apiKey,
        chainId: parseInt(getEnv('CHAIN_ID')),
        protocolsSecurityConfig: {
          riskLevel: 'low',
        },
      });
    } else {
      const config = await this.getFullConfig();
      this.sdk = await MyceliumSDK.init(config);
    }

    logResult('SDK initialized successfully!');
  }

  private printMenu() {
    printAvailableCliOptions();
  }

  private async getFullConfig(): Promise<MyceliumSDKConfig> {
    return getEnvsConfig() as MyceliumSDKConfig;
  }

  private async mainLoop() {
    let running = true;

    while (running) {
      this.printMenu();
      const choice = await this.ask('👉 Select an option: ');

      logState(`Selected: ${choice}`);

      switch (choice) {
        case '1':
          await this.createAccount();
          break;
        case '2':
          await this.loginAccount();
          break;
        case '3':
          await this.getBestVaults();
          break;
        case '4':
          await this.viewWalletDetails();
          break;
        case '5':
          await this.getEarningBalances();
          break;
        case '6':
          await this.topUpFromFaucet();
          break;
        case '7':
          await this.depositToVault();
          break;
        case '8':
          await this.withdrawFromVault();
          break;
        case '9':
        case 'exit':
          logState('Exiting CLI. Goodbye!');
          running = false;
          process.exit(0);
          break;
        default:
          console.log('⚠️  Invalid option, please try again.\n');
          break;
      }

      if (running) {
        logState('==================================');
      }
    }

    this.rl.close();
  }

  private async createAccount() {
    if (!this.sdk) {
      logError('SDK not initialized');
      return;
    }

    const email = await this.ask('📧 Enter your email address: ');
    if (!email) {
      logError('Email is required');
      return;
    }

    logState('Creating account...');
    try {
      const result = await this.sdk.wallet.createAccount();

      this.embeddedWalletId = result.embeddedWalletId;
      this.wallet = result.smartWallet;

      const address = await this.wallet.getAddress();

      this.db.saveWallet(email, this.embeddedWalletId);

      logState('Account created successfully!');
      logResult(`Embedded Wallet ID: ${this.embeddedWalletId}`);
      logResult(`Smart Wallet Address: ${address}`);
    } catch (error) {
      logError('Failed to create account', error);
    }
  }

  private async loginAccount() {
    if (!this.sdk) {
      logError('SDK not initialized');
      return;
    }

    const email = await this.ask('📧 Enter your email address: ');
    if (!email) {
      logError('Email is required');
      return;
    }

    const walletId = await this.db.getWalletByEmail(email);
    if (!walletId) {
      logError('Wallet not found');
      return;
    }

    this.embeddedWalletId = walletId;
    this.wallet = await this.sdk.wallet.getAccount({
      walletId,
    });

    logResult('Account logged in successfully!');
  }

  private async getBestVaults() {
    if (!this.sdk) {
      logError('SDK not initialized');
      return;
    }

    const currentBestVaults = await this.sdk.protocols.getBestVaults();

    const availableVaults = [...currentBestVaults.stable, ...currentBestVaults.nonStable].map(
      (vault, index) => {
        return {
          optionId: index + 1,
          vaultInfo: vault,
        };
      },
    );

    const formattedVaultsInfo = formatVaultInfoToDisplay(availableVaults);

    logState('Best Vaults:');
    logResult(`Here are best vault to invest:\n${formattedVaultsInfo}`);
  }

  private async viewWalletDetails() {
    if (!this.wallet) {
      logError("You didn't login. Please select Option 1 or 2 first to login or create an account");
      return;
    }

    const address = await this.wallet.getAddress();
    const balances = await this.wallet.getBalance();

    logResult('Wallet details:\n');
    logResult(`Address: ${address}`);
    logResult(
      `Tokens balances:\n${balances.map((balance) => `${balance.symbol}: ${balance.totalFormattedBalance}`).join('\n')}`,
    );
  }

  private async getEarningBalances() {
    if (!this.wallet) {
      logError("You didn't login. Please select Option 1 or 2 first to login or create an account");
      return;
    }

    const earningBalances = (await this.wallet.getEarnBalances()) as VaultBalance[];

    if (!earningBalances) {
      logError('No earning balances found');
      return;
    }

    const formattedBalances = earningBalances.map((balance) => {
      const currentBalance = balance.balance as ProxyBalance;
      return {
        vaultInfo: balance.vaultInfo,
        currentBalance: currentBalance.currentBalance ?? '0',
      };
    });

    const earnings = formatBalancesToDisplay(formattedBalances);

    logState('Earnings balance details:');
    logResult(`You current earnings:\n ${earnings ? earnings : 'Oops, nothing so far...'}`);
  }

  private async topUpFromFaucet() {
    if (!this.wallet) {
      logError("You didn't login. Please select Option 1 or 2 first to login or create an account");
      return;
    }

    const walletAddress = await this.wallet.getAddress();

    const response = await fetch(`${process.env.BLOCKCHAIN_SERVICE_HOSTNAME}/drop-funds`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        to: walletAddress,
        amountUsdc: '100',
        amountEth: '0.1',
      }),
    });
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`HTTP ${response.status}: ${errorText}`);
    }

    const data = await response.json();

    if (!data.ok) {
      logError('Failed to drop funds');
      logError(data.error);
      return;
    }
    logResult('Funds dropped successfully');
  }

  private async depositToVault() {
    if (!this.sdk || !this.wallet) {
      logError("You didn't login. Please select Option 1 or 2 first to login or create an account");
      return;
    }

    this.currentBestVaults = await this.sdk.protocols.getBestVaults();

    const availableVaults = [
      ...this.currentBestVaults.stable,
      ...this.currentBestVaults.nonStable,
    ].map((vault, index) => {
      return {
        optionId: index + 1,
        vaultInfo: vault,
      };
    });

    const formattedVaultsInfo = formatVaultInfoToDisplay(availableVaults);

    const balances = await this.wallet.getBalance();
    const usdcBalance =
      balances.find((balance) => balance.symbol === 'USDC')?.totalFormattedBalance ?? '0';

    logState('Available vaults:');
    logResult(formattedVaultsInfo);

    const optionToDeposit = await this.ask('Enter the option to deposit: ');
    const selectedVault = availableVaults.find(
      (vault) => vault.optionId === parseInt(optionToDeposit),
    );
    if (!selectedVault) {
      logError('Invalid option');
      return;
    }

    const amountToDeposit = await this.ask(
      `Enter the amount to deposit (current USDC balance: ${usdcBalance}): `,
    );
    if (
      !amountToDeposit ||
      !isValidAmountFormat(amountToDeposit) ||
      parseFloat(amountToDeposit) > parseFloat(usdcBalance)
    ) {
      logError('Invalid amount');
      return;
    }

    logState('Depositing to vault...');
    const result = await this.wallet.earn(selectedVault.vaultInfo, amountToDeposit);
    logResult(`Deposit completed: ${result.hash}`);
  }

  private async withdrawFromVault() {
    if (!this.sdk || !this.wallet) {
      logError("You didn't login. Please select Option 1 or 2 first to login or create an account");
      return;
    }

    const earningBalances = await this.wallet.getEarnBalances();

    if (!earningBalances) {
      logError('No earning balances found');
      return;
    }

    const balances = [...earningBalances].map((vault, index) => {
      const currentBalance = vault.balance as ProxyBalance;
      return {
        optionId: index + 1,
        vaultInfo: vault.vaultInfo,
        currentBalance: currentBalance.currentBalance ?? '0',
      };
    });

    const formattedBalances = formatBalancesToDisplay(balances);

    logState('Balances per vault:');
    logResult(formattedBalances);

    const optionToWithdraw = await this.ask('Select a vault to withdraw from: ');
    const selectedVault = balances.find((vault) => vault.optionId === parseInt(optionToWithdraw));
    if (!selectedVault) {
      logError('Invalid option');
      return;
    }

    logState(`Selected vault name: ${selectedVault.vaultInfo.name}`);

    const currentVaultBalance = selectedVault.currentBalance;

    logState(`Current vault balance: ${currentVaultBalance}`);
    const amountToWithdraw = await this.ask(
      `Enter the amount to withdraw (hit "enter" to withdraw all balance): `,
    );
    if (
      amountToWithdraw &&
      (!isValidAmountFormat(amountToWithdraw) ||
        parseFloat(amountToWithdraw) > parseFloat(currentVaultBalance))
    ) {
      logError('Invalid amount');
      return;
    }

    logState('Withdrawing from vault...');
    const result = await this.wallet.withdraw(selectedVault.vaultInfo, amountToWithdraw);
    logResult('Withdraw completed:', result.hash);
  }

  private ask(question: string): Promise<string> {
    const formattedQuestion = `${question}`;

    return new Promise((resolve) => {
      this.rl.question(formattedQuestion, (answer) => {
        resolve(answer.trim());
      });
    });
  }
}
