import type { ChainManager } from '@/tools/ChainManager';
import {
  type Address,
  type LocalAccount,
  erc20Abi,
  createWalletClient,
  http,
  parseGwei,
  parseUnits,
  formatUnits,
  type PublicClient,
} from 'viem';
import { GAS_RESERVE_MINIMUM, GAS_RESERVE_PERCENTAGE } from '@/constants/paymaster';
import type { SupportedChainId } from '@/constants/chains';
import type { SmartWallet } from '@/wallet/base/wallets/SmartWallet';
import type {
  VaultInfo,
  VaultBalance,
  VaultTxnResult,
  Vaults,
  ProtocolsSecurityConfig,
} from '@/types/protocols/general';
import type { ApiClient } from '@/tools/ApiClient';

/**
 * Base Protocol
 *
 * @internal
 * @abstract
 * @category Protocols
 * @remarks
 * Abstract class defining the contract for protocol integrations (e.g. Spark, Beefy, Aave, Morpho)
 * Provides lifecycle hooks (`init`) and required methods for vault discovery, deposit, withdrawal,
 * and balance tracking
 *
 * Generic parameters allow protocol-specific typing for vault info, balances, and transaction results
 */
export abstract class BaseProtocol {
  /** Selected chain ID for the protocol */
  protected selectedChainId: SupportedChainId | undefined;

  /** Public client to make requests to RPC */
  protected publicClient: PublicClient | undefined;

  /** Chain manager instance for network access */
  public chainManager: ChainManager | undefined;

  /**
   * Initialize the protocol
   * @param chainManager Chain manager for accessing RPC and bundler clients
   */
  abstract init(
    chainManager: ChainManager,
    protocolsSecurityConfig: ProtocolsSecurityConfig,
    apiClient?: ApiClient,
  ): Promise<void>;

  /**
   * Ensure the protocol has been initialized
   * @throws Error if `init()` has not been called
   */
  protected ensureInitialized(): void {
    if (!this.chainManager) {
      throw new Error('Protocol must be initialized before use. Call init() first.');
    }
  }

  /**
   * Get the best vault for deposits
   * @returns Single vault considered optimal for deposit
   */
  abstract getBestVaults(
    stableVaultsLimit?: number,
    nonStableVaultsLimit?: number,
  ): Promise<Vaults> | Vaults;

  /**
   * Deposit funds into a vault
   * @param vaultInfo Vault information
   * @param amount Amount in human-readable format
   * @param smartWallet Wallet executing the deposit
   * @returns Result of the deposit transaction
   */
  abstract deposit(
    vaultInfo: VaultInfo,
    amount: string,
    smartWallet: SmartWallet,
    options?: { paymasterToken?: Address },
  ): Promise<VaultTxnResult>;

  /**
   * Withdraw funds from a vault
   * @param vaultInfo Vault information
   * @param amount Amount in human-readable format (or undefined to withdraw all)
   * @param smartWallet Wallet executing the withdrawal
   * @returns Result of the withdrawal transaction
   */
  abstract withdraw(
    vaultInfo: VaultInfo,
    amount: string | undefined,
    smartWallet: SmartWallet,
    options?: { paymasterToken?: Address },
  ): Promise<VaultTxnResult>;

  /**
   * Get deposited balance in a vault
   * @param walletAddress Wallet address to check the balance of
   * @param protocolId Protocol ID to get balances for
   * @returns Balance of deposited funds
   */
  abstract getBalances(walletAddress: Address, protocolId?: string): Promise<VaultBalance[]>;

  /**
   * Approve a token for protocol use
   * @param tokenAddress Token address
   * @param spenderAddress Spender address
   * @param amount Allowance amount in wei
   * @param chainId Target chain ID
   * @param account Account authorizing the approval
   * @returns Transaction hash
   */
  protected async approveToken(
    tokenAddress: Address,
    spenderAddress: Address,
    amount: bigint,
    chainId: SupportedChainId,
    account: LocalAccount,
  ): Promise<string> {
    this.ensureInitialized();

    const walletClient = createWalletClient({
      account,
      chain: this.chainManager!.getChain(chainId),
      transport: http(this.chainManager!.getRpcUrl(chainId)),
    });

    const hash = await walletClient.writeContract({
      address: tokenAddress,
      abi: erc20Abi,
      functionName: 'approve',
      args: [spenderAddress, amount],
      gas: 100000n,
      maxFeePerGas: parseGwei('20'),
      maxPriorityFeePerGas: parseGwei('2'),
    });

    return hash;
  }

  /**
   * Check token allowance for a spender
   * @param tokenAddress Token address
   * @param spenderAddress Spender address
   * @param walletAddress Wallet address granting allowance
   * @param chainId Target chain ID
   * @returns Current allowance amount
   */
  protected async checkAllowance(
    tokenAddress: Address,
    spenderAddress: Address,
    walletAddress: Address,
    chainId: SupportedChainId,
  ): Promise<bigint> {
    this.ensureInitialized();

    const publicClient = this.chainManager!.getPublicClient(chainId);

    return await publicClient.readContract({
      address: tokenAddress,
      abi: erc20Abi,
      functionName: 'allowance',
      args: [walletAddress, spenderAddress],
    });
  }

  /**
   * Validate gas reserve balance for operations using paymaster
   * Ensures sufficient balance remains for gas payment when using paymaster with the same token
   * @param tokenAddress Token address to check balance for
   * @param walletAddress Wallet address to check
   * @param tokenDecimals Number of decimals for the token
   * @param operationAmount Optional: Amount for deposit operation (in token units). If provided, validates deposit; otherwise validates withdraw
   * @throws Error if balance is insufficient for gas payment or operation
   */
  protected async validateGasReserve(
    tokenAddress: Address,
    walletAddress: Address,
    tokenDecimals: number,
    operationAmount?: bigint,
  ): Promise<void> {
    this.ensureInitialized();
    const chainId = this.getSelectedChainId();
    const publicClient = this.chainManager!.getPublicClient(chainId);
    const balance = await publicClient.readContract({
      address: tokenAddress,
      abi: erc20Abi,
      functionName: 'balanceOf',
      args: [walletAddress],
    });

    const gasReserve = this.calculateGasReserve(balance, tokenDecimals);

    if (operationAmount !== undefined) {
      // Check if operation amount exceeds available balance after gas reserve
      const maxDepositAmount = balance > gasReserve ? balance - gasReserve : 0n;

      if (operationAmount > maxDepositAmount) {
        const maxDepositFormatted = formatUnits(maxDepositAmount, tokenDecimals);
        throw new Error(
          `Insufficient balance. Must reserve tokens for gas payment. Max deposit: ${maxDepositFormatted}`,
        );
      }
    } else {
      // Check if balance meets minimum gas reserve requirement
      const minRequiredBalance = gasReserve;

      if (balance < minRequiredBalance) {
        const minRequiredFormatted = formatUnits(minRequiredBalance, tokenDecimals);
        throw new Error(
          `Insufficient wallet balance for gas payment. Wallet needs at least ${minRequiredFormatted} tokens to pay for gas before withdrawal.`,
        );
      }
    }
  }

  /**
   * Calculate gas reserve amount based on balance and token decimals
   * Uses a more sophisticated calculation that considers token decimal places:
   * - For tokens with low decimals (≤6): uses a fixed minimum amount configured via
   *   GAS_RESERVE_MINIMUM (e.g., currently 0.01 tokens), with at least 1 unit reserved
   * - For tokens with higher decimals (>6): uses the maximum of GAS_RESERVE_PERCENTAGE%
   *   of the balance and a fixed minimum (GAS_RESERVE_MINIMUM), ensuring a balance-independent
   *   minimum for withdraw validation
   * @param balance Current token balance
   * @param tokenDecimals Number of decimals for the token
   * @returns Gas reserve amount in token units
   */
  protected calculateGasReserve(balance: bigint, tokenDecimals: number): bigint {
    // For tokens with low decimals (e.g., 6-decimal tokens like USDC), use a fixed minimum
    // This ensures sufficient gas coverage for high-value or low-decimal tokens
    if (tokenDecimals <= 6) {
      // Reserve GAS_RESERVE_MINIMUM tokens (e.g., 0.01) or 1 unit if that's larger
      const fixedReserve = parseUnits(GAS_RESERVE_MINIMUM, tokenDecimals);
      const oneUnit = 1n;
      return fixedReserve > oneUnit ? fixedReserve : oneUnit;
    }

    // For tokens with higher decimals, use the maximum of percentage-based and fixed minimum
    // This ensures withdraw validation has a meaningful balance-independent minimum
    const percentageReserve = (balance * BigInt(GAS_RESERVE_PERCENTAGE)) / 100n;
    const fixedMinimum = parseUnits(GAS_RESERVE_MINIMUM, tokenDecimals);

    // Return the maximum of the two to ensure adequate reserve for gas payment
    return percentageReserve > fixedMinimum ? percentageReserve : fixedMinimum;
  }

  /**
   * Get the selected chain ID, ensuring it has been initialized
   * @returns The selected chain ID
   * @throws Error if `init()` has not been called or chain ID is not set
   */
  protected getSelectedChainId(): SupportedChainId {
    this.ensureInitialized();
    if (this.selectedChainId === undefined) {
      throw new Error('Protocol chain ID not set. Ensure init() was called successfully.');
    }
    return this.selectedChainId;
  }
}
