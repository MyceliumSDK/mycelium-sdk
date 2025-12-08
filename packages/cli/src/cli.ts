import * as readline from 'readline';
import {
  MyceliumSDK,
  type MyceliumSDKConfig,
  type SmartWallet,
  type VaultInfo,
  type Vaults,
} from '@mycelium-sdk/core';
import { formatBalancesToDisplay, formatVaultInfoToDisplay, getEnv } from './utils';
import { WalletDatabase } from './database';

export class CLI {
  private rl: readline.Interface;
  private sdk: MyceliumSDK | null = null;
  private wallet: SmartWallet | null = null;
  private embeddedWalletId: string | null = null;

  private currentBestVaults: Vaults | null = null;
  private currentUserSelectedVault: VaultInfo | null = null;

  private db: WalletDatabase;

  constructor() {
    this.rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });

    this.db = new WalletDatabase();
  }

  async start() {
    console.clear();
    console.log('\n🚀 Mycelium SDK CLI');
    console.log('=====================\n');

    try {
      await this.initializeSDK();
      // Start the main interaction loop
      await this.mainLoop();
    } catch (error) {
      console.error('❌ Critical Error during startup:', error);
      this.rl.close();
    }
  }

  private async initializeSDK() {
    const apiKey = getEnv('API_KEY');

    if (apiKey) {
      console.log('📝 Initializing SDK with API key from environment...\n');
      this.sdk = await MyceliumSDK.init({
        apiKey,
        protocolsSecurityConfig: {
          riskLevel: 'low',
        },
      });
    } else {
      const config = await this.getFullConfig();
      this.sdk = await MyceliumSDK.init(config);
    }

    console.log('✅ SDK initialized successfully!\n');
  }
  catch(error: unknown) {
    // console.error('❌ Failed to initialize SDK:', error);
    throw error;
  }

  private printMenu() {
    console.log('AVAILABLE ACTIONS:');
    console.log('1. Create account');
    console.log('2. Login to account');
    console.log('3. Get best vaults');
    console.log('4. View wallet details');
    console.log('5. Get earning balances');
    console.log('6. Top up from faucet');
    console.log('7. Deposit to vault');
    console.log('8. Withdraw from vault');
    console.log('9. Exit');
    console.log(''); // Empty line
  }

  private async getFullConfig(): Promise<MyceliumSDKConfig> {
    return {
      integratorId: getEnv('INTEGRATOR_ID'),
      walletsConfig: {
        embeddedWalletConfig: {
          provider: {
            type: 'privy',
            providerConfig: {
              appId: getEnv('PRIVY_APP_ID'),
              appSecret: getEnv('PRIVY_APP_SECRET'),
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
        chainId: parseInt(getEnv('CHAIN_ID')),
        rpcUrl: getEnv('RPC_URL'),
        bundlerUrl: getEnv('BUNDLER_URL'),
      },
      protocolsSecurityConfig: {
        riskLevel: 'low',
      },
      coinbaseCDPConfig: {
        apiKeyId: getEnv('COINBASE_CDP_API_KEY_ID'),
        apiKeySecret: getEnv('COINBASE_CDP_API_KEY_SECRET'),
      },
    };
  }

  private async mainLoop() {
    let running = true;

    while (running) {
      this.printMenu();
      const choice = await this.ask('👉 Select an option: ');

      console.log(`\nSelected: ${choice}\n-------------------`);

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
          console.log('👋 Exiting CLI. Goodbye!');
          running = false;
          break;
        default:
          console.log('⚠️  Invalid option, please try again.\n');
          break;
      }

      // Add a small divider for visual separation of "previous response"
      if (running) {
        console.log('\n==================================\n');
      }
    }

    this.rl.close();
  }

  private async createAccount() {
    if (!this.sdk) {
      console.log('❌ SDK not initialized');
      return;
    }

    const email = await this.ask('📧 Enter your email address: ');
    if (!email) {
      console.log('❌ Email is required.');
      return;
    }

    console.log('\nCreating account...');
    try {
      const result = await this.sdk.wallet.createAccount();

      this.embeddedWalletId = result.embeddedWalletId;
      this.wallet = result.smartWallet;

      const address = await this.wallet.getAddress();

      this.db.saveWallet(email, this.embeddedWalletId);

      console.log('✅ Account created successfully!');
      console.log(`   Embedded Wallet ID: ${this.embeddedWalletId}`);
      console.log(`   Smart Wallet Address: ${address}\n`);
    } catch (error) {
      console.error('❌ Failed to create account:', error);
    }
  }

  private async loginAccount() {
    if (!this.sdk) {
      console.log('❌ SDK not initialized');
      return;
    }

    const email = await this.ask('📧 Enter your email address: ');
    if (!email) {
      console.log('❌ Email is required.');
      return;
    }

    const walletId = await this.db.getWalletByEmail(email);
    if (!walletId) {
      console.log('❌ Wallet not found.');
      return;
    }

    this.embeddedWalletId = walletId;
    this.wallet = await this.sdk.wallet.getAccount({
      walletId,
    });

    console.log('✅ Account logged in successfully!');
  }

  private async getBestVaults() {
    if (!this.sdk) {
      console.log('❌ SDK not initialized');
      return;
    }

    this.currentBestVaults = await this.sdk.protocols.getBestVaults();

    console.log('💰 Best Vaults:');
    console.log(this.currentBestVaults);
  }

  private async viewWalletDetails() {
    if (!this.wallet) {
      console.log(
        "⚠️  You didn't login. Please select Option 1 or 2 first to login or create an account",
      );
      return;
    }

    const address = await this.wallet.getAddress();
    const balances = await this.wallet.getBalance();

    console.log({ balances });

    console.log('💰 Wallet Details:');
    console.log(`   Address: ${address}`);
    console.log(
      `   Balances: ${balances.map((balance) => `${balance.symbol}: ${balance.totalFormattedBalance}`).join('\n')}`,
    );
  }

  private async getEarningBalances() {
    if (!this.wallet) {
      console.log(
        "⚠️  You didn't login. Please select Option 1 or 2 first to login or create an account",
      );
      return;
    }

    const earningBalances = await this.wallet.getEarnBalances();

    if (!earningBalances) {
      console.log('❌ No earning balances found');
      return;
    }

    const formattedBalances = earningBalances.map((balance) => ({
      vaultInfo: balance.vaultInfo,
      currentBalance: balance.balance?.currentBalance ?? '0',
    }));

    console.log('💰 Earnings balance details:');
    console.log(formatBalancesToDisplay(formattedBalances));
  }

  private async topUpFromFaucet() {
    if (!this.wallet) {
      console.log(
        "❌ You didn't login. Please select Option 1 or 2 first to login or create an account",
      );
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
      console.log('❌ Failed to drop funds');
      console.log(data.error);
      return;
    }
    console.log('✅ Funds dropped successfully');
  }

  private async depositToVault() {
    if (!this.sdk || !this.wallet) {
      console.log(
        "❌ You didn't login. Please select Option 1 or 2 first to login or create an account",
      );
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

    console.log('💰 Available vaults:');
    console.log(formattedVaultsInfo);

    const optionToDeposit = await this.ask('📧 Enter the option to deposit: ');
    const selectedVault = availableVaults.find(
      (vault) => vault.optionId === parseInt(optionToDeposit),
    );
    if (!selectedVault) {
      console.log('❌ Invalid option');
      return;
    }

    const amountToDeposit = await this.ask(
      `📧 Enter the amount to deposit (current USDC balance: ${usdcBalance}): `,
    );
    if (!amountToDeposit || parseFloat(amountToDeposit) > parseFloat(usdcBalance)) {
      console.log('❌ Invalid amount');
      return;
    }

    console.log('💰 Depositing to vault...');
    const result = await this.wallet.earn(selectedVault.vaultInfo, amountToDeposit);
    console.log('💰 Deposit completed:', result.hash);
  }

  private async withdrawFromVault() {
    if (!this.sdk || !this.wallet) {
      console.log(
        "❌ You didn't login. Please select Option 1 or 2 first to login or create an account",
      );
      return;
    }

    const earningBalances = await this.wallet.getEarnBalances();

    if (!earningBalances) {
      console.log('❌ No earning balances found');
      return;
    }

    const balances = [...earningBalances].map((vault, index) => {
      return {
        optionId: index + 1,
        vaultInfo: vault.vaultInfo,
        currentBalance: vault.balance?.currentBalance ?? '0',
      };
    });

    const formattedBalances = formatBalancesToDisplay(balances);

    console.log('💰 Balances per vault:');
    console.log(formattedBalances);

    const optionToWithdraw = await this.ask('📧 Select a vault to withdraw from: ');
    const selectedVault = balances.find((vault) => vault.optionId === parseInt(optionToWithdraw));
    if (!selectedVault) {
      console.log('❌ Invalid option');
      return;
    }

    console.log('💰 Selected vault:', selectedVault.vaultInfo);

    const currentVaultBalance = selectedVault.currentBalance;

    console.log(`📧 Current vault balance: ${currentVaultBalance}`);
    const amountToWithdraw = await this.ask(
      `📧 Enter the amount to withdraw (hit "enter" to withdraw all balance): `,
    );
    if (
      amountToWithdraw &&
      (isNaN(parseFloat(amountToWithdraw)) ||
        parseFloat(amountToWithdraw) <= 0 ||
        parseFloat(amountToWithdraw) > parseFloat(currentVaultBalance))
    ) {
      console.log('❌ Invalid amount');
      return;
    }

    console.log('💰 Withdrawing from vault...');
    const result = await this.wallet.withdraw(selectedVault.vaultInfo, amountToWithdraw);
    console.log('💰 Withdraw completed:', result.hash);
  }

  private ask(question: string): Promise<string> {
    return new Promise((resolve) => {
      this.rl.question(question, (answer) => {
        resolve(answer.trim());
      });
    });
  }
}
