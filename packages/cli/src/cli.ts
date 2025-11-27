import * as readline from 'readline';
import { MyceliumSDK, type MyceliumSDKConfig, type SmartWallet } from '@mycelium-sdk/core';
import { getEnv } from './utils';
import { WalletDatabase } from './database';

export class CLI {
  private rl: readline.Interface;
  private sdk: MyceliumSDK | null = null;
  private wallet: SmartWallet | null = null;
  private embeddedWalletId: string | null = null;

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
    console.error('❌ Failed to initialize SDK:', error);
    throw error;
  }

  private printMenu() {
    console.log('AVAILABLE ACTIONS:');
    console.log('1. Create account');
    console.log('2. Login to account');
    console.log('3. Get best vaults');
    console.log('4. View Wallet Details');
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
      if (running) {console.log('\n==================================\n');}
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

    const bestVaults = await this.sdk.protocols.getBestVaults();

    console.log('💰 Best Vaults:');
    console.log(bestVaults);
  }

  private async viewWalletDetails() {
    if (!this.wallet) {
      console.log(
        "⚠️  You didn't login. Please select Option 1 or 2 first to login or create an account",
      );
      return;
    }

    console.log('💰 Wallet Details:');
    console.log(`   Address: ${await this.wallet.getAddress()}`);
  }

  private ask(question: string): Promise<string> {
    return new Promise((resolve) => {
      this.rl.question(question, (answer) => {
        resolve(answer.trim());
      });
    });
  }
}
