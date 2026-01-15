import {
  type Address,
  type Hash,
  type LocalAccount,
  encodeFunctionData,
  erc20Abi,
  pad,
} from 'viem';

import { smartWalletFactoryAbi } from '@/abis/smartWalletFactory';
import { smartWalletFactoryAddress } from '@/constants/addresses';
import type { SupportedChainId } from '@/constants/chains';
import type { ChainManager } from '@/tools/ChainManager';
import { fetchERC20Balance, fetchETHBalance } from '@/tools/TokenBalance';
import { SUPPORTED_TOKENS } from '@/constants/tokens';
import type { TokenBalance } from '@/types/token';
import { type AssetIdentifier, parseAssetAmount, resolveAsset } from '@/utils/assets';
import { SmartWallet } from '@/wallet/base/wallets/SmartWallet';
import type { TransactionData } from '@/types/transaction';
import type { VaultBalance, VaultInfo, VaultTxnResult } from '@/types/protocols/general';
import type { CoinbaseCDP } from '@/tools/CoinbaseCDP';
import type { OffRampUrlResponse, OnRampUrlResponse } from '@/types/ramp';
import type { BaseProtocol } from '@/protocols/base/BaseProtocol';
import { toCoinbaseSmartAccount, type WebAuthnAccount } from 'viem/account-abstraction';
import { Paymaster } from '@/tools/Paymaster';

/**
 * Default ERC-4337 smart wallet implementation. Implements main methods that a user can use to interact with DeFi protocols and use all related functionalities
 *
 * @public
 * @category 3. Account operations
 * @remarks
 * Backed by Coinbase Smart Account and compatible with ERC-4337 UserOperations
 * Supports multi-owner wallets (EVM addresses or WebAuthn owners), gas-sponsored flows,
 * and cross-chain operations via {@link ChainManager}
 */
export class DefaultSmartWallet extends SmartWallet {
  /** Owners (EVM addresses or WebAuthn public keys) */
  private owners: Array<Address | WebAuthnAccount>;
  /** Signer for transactions and UserOperations */
  private _signer: LocalAccount;
  /** Index of signer within the owners array (undefined → default 0) */
  private signerOwnerIndex?: number;
  /** Known deployment address (if already deployed) */
  private deploymentAddress?: Address;
  /** Network and client management */
  private chainManager: ChainManager;
  /** Nonce (salt) for deterministic address calculation */
  private nonce?: bigint;
  /** Selected protocol provider instance */
  private protocolProvider: BaseProtocol; // Protocol['instance'];
  /** Coinbase CDP instance to interact with Coinbase CDP API */
  private coinbaseCDP: CoinbaseCDP | null;
  /** Paymaster instance for gas sponsoring */
  private paymaster: Paymaster;

  /**
   * Creates a smart wallet instance
   *
   * @internal
   * @param owners Owners (addresses or WebAuthn accounts)
   * @param signer Local account used to sign
   * @param chainManager Chain/client manager
   * @param protocolProvider Protocol provider instance (selected upstream)
   * @param deploymentAddress Optional known deployment address
   * @param signerOwnerIndex Optional index of `signer` in owners (default 0)
   * @param nonce Optional salt for deterministic address calc (default 0)
   */
  constructor(
    owners: Array<Address | WebAuthnAccount>,
    signer: LocalAccount,
    chainManager: ChainManager,
    protocolProvider: BaseProtocol,
    coinbaseCDP: CoinbaseCDP | null,
    deploymentAddress?: Address,
    signerOwnerIndex?: number,
    nonce?: bigint,
  ) {
    super();
    this.owners = owners;
    this._signer = signer;
    this.signerOwnerIndex = signerOwnerIndex;
    this.deploymentAddress = deploymentAddress;
    this.chainManager = chainManager;
    this.nonce = nonce;
    this.protocolProvider = protocolProvider;
    this.coinbaseCDP = coinbaseCDP;
    this.paymaster = new Paymaster(this.chainManager);
  }

  /**
   * Returns the signer account for this smart wallet
   *
   * @public
   * @category Account
   * @remarks
   * Used to authorize UserOperations and on-chain transactions
   */
  get signer(): LocalAccount {
    return this._signer;
  }

  /**
   * Resolves the smart wallet address
   *
   * @public
   * @category Account
   * @remarks
   * If `deploymentAddress` is known, returns it. Otherwise derives a deterministic address
   * via the factory (`getAddress`) using owners and `nonce` (CREATE2-style)
   *
   * @returns Promise that resolves to the wallet address
   * @throws Error if no supported chains are configured
   * @throws Error if an owner has an invalid type
   */
  async getAddress() {
    if (this.deploymentAddress) {
      return this.deploymentAddress;
    }

    const owners_bytes = this.owners.map((owner) => {
      if (typeof owner === 'string') {
        return pad(owner);
      }
      if (owner.type === 'webAuthn') {
        return owner.publicKey;
      }
      throw new Error('invalid owner type');
    });

    // Factory is the same across all chains, so we can use the first chain to get the wallet address
    const supportedChain = this.chainManager.getSupportedChain();
    if (!supportedChain) {
      throw new Error('No supported chains configured');
    }
    const publicClient = this.chainManager.getPublicClient(supportedChain);
    const smartWalletAddress = await publicClient.readContract({
      abi: smartWalletFactoryAbi,
      address: smartWalletFactoryAddress,
      functionName: 'getAddress',
      args: [owners_bytes, this.nonce || 0n],
    });
    return smartWalletAddress;
  }

  private bumpGasLimits = (x: bigint, pct = 40n) => x + (x * pct) / 100n;

  /**
   * Builds a Coinbase Smart Account for a specific chain
   *
   * @internal
   * @category Account
   * @param chainId Target chain ID
   * @returns Viem Coinbase Smart Account for the given chain
   */
  async getCoinbaseSmartAccount(
    chainId: SupportedChainId,
  ): ReturnType<typeof toCoinbaseSmartAccount> {
    return toCoinbaseSmartAccount({
      address: this.deploymentAddress,
      ownerIndex: this.signerOwnerIndex,
      client: this.chainManager.getPublicClient(chainId),
      owners: [this.signer],
      nonce: this.nonce,
      version: '1.1',
    });
  }

  /**
   * Fetches balances (ETH + ERC-20) for a smart account across supported chains
   *
   * @public
   * @category Account
   * @returns Promise resolving to a list of {@link TokenBalance}
   */
  async getBalance(): Promise<TokenBalance[]> {
    const address = await this.getAddress();
    const tokenBalancePromises = Object.values(SUPPORTED_TOKENS).map(async (token) => {
      return fetchERC20Balance(this.chainManager, address, token);
    });

    const ethBalancePromise = fetchETHBalance(this.chainManager, address);

    return Promise.all([ethBalancePromise, ...tokenBalancePromises]);
  }

  /**
   * Deposits into the selected protocol’s vault to start earning yield
   * @public
   * @category Earn
   * @remarks
   * The protocol is selected on the SDK initialization step
   * @param amount Human-readable amount string
   * @param options Optional parameters
   * @param options.paymasterToken ERC-20 token address to use for gas payment (e.g., USDC)
   * @returns Transaction result for the deposit
   */
  async earn(
    vaultInfo: VaultInfo,
    amount: string,
    options?: { paymasterToken?: Address },
  ): Promise<VaultTxnResult> {
    const depositTransactionResult = this.protocolProvider.deposit(
      vaultInfo,
      amount,
      this,
      options,
    );

    return depositTransactionResult;
  }

  /**
   * Reads current deposit balance from the selected protocol’s vault
   * Method to read the current deposit balance from the selected protocol’s vault for a smart account
   *
   * @public
   * @category Earn
   * @returns Vault balance or `null` if nothing deposited
   */
  async getEarnBalances(): Promise<VaultBalance[]> {
    const userAddress = await this.getAddress();
    return this.protocolProvider.getBalances(userAddress);
  }

  /**
   * Withdraws from the selected protocol’s vault
   * @public
   * @category Earn
   * @param amount Human-readable amount string
   * @param options Optional parameters
   * @param options.paymasterToken ERC-20 token address to use for gas payment (e.g., USDC)
   * @returns Transaction result for the withdrawal
   * @throws Error if the withdrawal fails
   * @throws Error a user didn't deposit anything
   */
  async withdraw(
    vaultInfo: VaultInfo,
    amount: string,
    options?: { paymasterToken?: Address },
  ): Promise<VaultTxnResult> {
    const withdrawTransactionResult = await this.protocolProvider.withdraw(
      vaultInfo,
      amount,
      this,
      options,
    );

    return withdrawTransactionResult;
  }

  /**
   * Builds a UserOperation and submits via the bundler, then waits for inclusion

   *
   * @public
   * @category Transactions
   *
   * @param transactionData Transaction details (`to`, `value`, `data`)
   * @param chainId Target chain ID
   * @param options Optional parameters
   * @param options.paymasterToken ERC-20 token address to use for gas payment (e.g., USDC)
   * @returns Promise that resolves to the UserOperation hash
   * @throws Error with a readable message if submission or inclusion fails
   */
  async send(
    transactionData: TransactionData,
    chainId: SupportedChainId,
    options?: {
      paymasterToken?: Address;
    },
  ): Promise<Hash> {
    try {
      const account = await this.getCoinbaseSmartAccount(chainId);

      // If the paymasterToken is provided, use the ERC-20 paymaster
      if (options?.paymasterToken) {
        const walletAddress = await this.getAddress();
        return this.paymaster.sendWithERC20Paymaster(
          transactionData,
          account,
          walletAddress,
          chainId,
          options.paymasterToken,
        );
      }

      const bundlerClient = this.chainManager.getBundlerClient(chainId, account);

      const gas = await bundlerClient.estimateUserOperationGas({
        account,
        calls: [transactionData],
      });

      const hash = await bundlerClient.sendUserOperation({
        account,
        calls: [transactionData],
        callGasLimit: this.bumpGasLimits(gas.callGasLimit),
        verificationGasLimit: this.bumpGasLimits(gas.verificationGasLimit),
        preVerificationGas: this.bumpGasLimits(gas.preVerificationGas),
      });

      await bundlerClient.waitForUserOperationReceipt({
        hash,
      });

      return hash;
    } catch (error) {
      throw new Error(
        `Failed to send transaction: ${error instanceof Error ? error.message.toString().slice(0, 100) : 'Unknown error'}`,
      );
    }
  }

  /**
   * Builds a UserOperation from several onchain transactions and submits via the bundler, then waits for inclusion
   *
   * @public
   * @category Transactions
   *
   * @param transactionData An array of calls to execute
   * @param chainId Target chain ID
   * @param options Optional parameters
   * @param options.paymasterToken ERC-20 token address to use for gas payment (e.g., USDC)
   * @returns Promise that resolves to the UserOperation hash for the batch
   * @throws Error with a readable message if submission or inclusion fails
   */
  async sendBatch(
    transactionData: TransactionData[],
    chainId: SupportedChainId,
    options?: { paymasterToken?: Address },
  ): Promise<Hash> {
    try {
      const account = await this.getCoinbaseSmartAccount(chainId);

      // If the paymasterToken is provided, use the ERC-20 paymaster
      if (options?.paymasterToken) {
        const walletAddress = await this.getAddress();
        return this.paymaster.sendWithERC20Paymaster(
          transactionData,
          account,
          walletAddress,
          chainId,
          options.paymasterToken,
        );
      }

      const bundlerClient = this.chainManager.getBundlerClient(chainId, account);

      const gas = await bundlerClient.estimateUserOperationGas({
        account,
        calls: transactionData,
      });

      const hash = await bundlerClient.sendUserOperation({
        account,
        calls: transactionData,
        callGasLimit: this.bumpGasLimits(gas.callGasLimit),
        verificationGasLimit: this.bumpGasLimits(gas.verificationGasLimit),
        preVerificationGas: this.bumpGasLimits(gas.preVerificationGas),
      });

      await bundlerClient.waitForUserOperationReceipt({
        hash,
      });

      return hash;
    } catch (error) {
      throw new Error(
        `Failed to send transaction: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }
  }

  /**
   * Funds the smart wallet with the specified amount of the specified token via Coinbase CDP on-ramp service
   *
   * @public
   * @category Funding
   *
   * @remarks
   * If Coinbase CDP is not initialized, the method will throw an error. For more details, visit @see {@link https://docs.cdp.coinbase.com/api-reference/v2/rest-api/onramp/create-an-onramp-session}
   *
   * @param amount Amount of token that a user wants to purchase and top up his account with (e.g., `"100"`, `"1.5"`)
   * @param redirectUrl URL to redirect to after the on-ramp is complete. It's required to be a valid URL
   * @param purchaseCurrency Purchase currency (e.g., `"USDC"`, `"ETH"`)
   * @param paymentCurrency Payment currency (e.g., `"USD"`, `"EUR"`)
   * @param paymentMethod Payment method (e.g., `"CARD"`)
   * @param chain Chain name (e.g., `"base"`)
   * @param country Country code (e.g., `"US"`)
   *
   *
   * @returns @see {@link OnRampUrlResponse}
   */
  async topUp(
    amount: string,
    redirectUrl: string,
    purchaseCurrency?: string,
    paymentCurrency?: string,
    paymentMethod?: string,
    country?: string,
  ): Promise<OnRampUrlResponse> {
    if (!this.coinbaseCDP) {
      throw new Error(
        'Coinbase CDP is not initialized. Please, provide the configuration in the SDK initialization',
      );
    }

    const address = await this.getAddress();

    const onRampLink = await this.coinbaseCDP.getOnRampLink(
      address,
      redirectUrl,
      amount,
      purchaseCurrency,
      paymentCurrency,
      paymentMethod,
      country,
    );

    return onRampLink;
  }

  /**
   * Cashout token from smart wallet to fiat currency via Coinbase CDP off-ramp service
   *
   * @public
   * @category Funding
   *
   * @remarks
   * If Coinbase CDP is not initialized, the method will throw an error. For more details, visit @see {@link https://docs.cdp.coinbase.com/api-reference/rest-api/onramp-offramp/create-sell-quote}
   *
   * @param country Country code (e.g., `"US"`)
   * @param paymentMethod Payment method (e.g., `"CARD"`). To get the ful list, visit ""
   * @param redirectUrl URL to redirect to after the off-ramp is complete. It's required to be a valid URL
   * @param sellAmount Amount of token that a user wants to sell (e.g., `"100"`, `"1.5"`)
   * @param cashoutCurrency Cashout currency (e.g., `"USD"`, `"EUR"`). To get the ful list, visit ""
   * @param sellCurrency Sell currency (e.g., `"USDC"`, `"ETH"`). To get the ful list, visit ""
   *
   *
   * @returns @see {@link OffRampUrlResponse}
   */
  async cashOut(
    country: string,
    paymentMethod: string,
    redirectUrl: string,
    sellAmount: string,
    cashoutCurrency?: string,
    sellCurrency?: string,
  ): Promise<OffRampUrlResponse> {
    if (!this.coinbaseCDP) {
      throw new Error(
        'Coinbase CDP is not initialized. Please, provide the configuration in the SDK initialization',
      );
    }

    const address = await this.getAddress();

    const offRampLink = await this.coinbaseCDP.getOffRampLink(
      address,
      country,
      paymentMethod,
      redirectUrl,
      sellAmount,
      cashoutCurrency,
      sellCurrency,
    );

    return offRampLink;
  }

  /**
   * Send tokens from a smart account to another address
   *
   * @public
   * @category Transactions
   *
   * @param amount Human-readable amount (e.g., `1.5`)
   * @param asset Asset symbol (e.g., `"usdc"`, `"eth"`) or token address
   * @param recipientAddress Destination address
   * @returns Transaction data suitable for inclusion in a UserOperation/call
   * @throws Error if `recipientAddress` is missing, `amount` ≤ 0, or asset cannot be resolved
   */
  async sendTokens(
    amount: number,
    asset: AssetIdentifier,
    recipientAddress: Address,
  ): Promise<TransactionData> {
    if (!recipientAddress) {
      throw new Error('Recipient address is required');
    }

    // Validate amount
    if (amount <= 0) {
      throw new Error('Amount must be greater than 0');
    }

    const chainId = this.chainManager.getSupportedChain();

    // Handle ETH transfers
    if (asset.toLowerCase() === 'eth') {
      const parsedAmount = parseAssetAmount(amount, 18); // ETH has 18 decimals

      return {
        to: recipientAddress,
        value: parsedAmount,
        data: '0x',
      };
    }

    // Handle ERC20 token transfers
    const resolvedAsset = resolveAsset(asset, chainId);
    const parsedAmount = parseAssetAmount(amount, resolvedAsset.decimals);

    // Encode ERC20 transfer function call
    const transferData = encodeFunctionData({
      abi: erc20Abi,
      functionName: 'transfer',
      args: [recipientAddress, parsedAmount],
    });

    return {
      to: resolvedAsset.address,
      value: 0n,
      data: transferData,
    };
  }
}
