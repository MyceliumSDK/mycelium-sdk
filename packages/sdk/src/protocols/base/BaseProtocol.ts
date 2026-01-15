import type { ChainManager } from '@/tools/ChainManager';
import {
  type Address,
  type LocalAccount,
  erc20Abi,
  createWalletClient,
  http,
  parseGwei,
  type PublicClient,
} from 'viem';
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
    amountInShares: string,
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
}
