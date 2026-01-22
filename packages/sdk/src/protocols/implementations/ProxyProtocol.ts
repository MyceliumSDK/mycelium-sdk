import { BaseProtocol } from '@/protocols/base/BaseProtocol';
import type { ChainManager } from '@/tools/ChainManager';
import type {
  ProtocolsSecurityConfig,
  VaultBalance,
  VaultInfo,
  Vaults,
  VaultTxnResult,
} from '@/types/protocols/general';
import type { OperationCallDataType, ProxyBalance, ProxyVaults } from '@/types/protocols/proxy';
import { encodeFunctionData, erc20Abi, parseUnits, type Address, type Hash } from 'viem';
import type { SmartWallet } from '@/public/types';
import type { ApiClient } from '@/tools/ApiClient';

/**
 * Proxy protocol implementation that communicates with the backend to find optimal vaults
 * and interact with optimal protocols
 *
 * @internal
 * @category Protocols
 * @remarks
 * This class works as a proxy protocol class that:
 * - Communicates with the backend API to discover and select optimal vaults
 * - Interacts with optimal protocols based on security configuration
 * - Handles all operations related to protocol interactions including deposits, withdrawals,
 *   balance queries, and operation logging
 * - Acts as an intermediary layer between the SDK and underlying DeFi protocols
 */
export class ProxyProtocol extends BaseProtocol {
  /** API client for the backend API */
  private apiClient!: ApiClient;

  /** Protocols security config */
  private protocolsSecurityConfig!: ProtocolsSecurityConfig;

  /**
   * Initialize the Spark protocol with the provided chain manager
   * @param chainManager Chain manager instance used for network operations
   */
  async init(
    chainManager: ChainManager,
    protocolsSecurityConfig: ProtocolsSecurityConfig,
    apiClient: ApiClient,
  ): Promise<void> {
    this.chainManager = chainManager;
    this.selectedChainId = chainManager.getSupportedChain();

    this.publicClient = chainManager.getPublicClient(this.selectedChainId!);

    this.apiClient = apiClient;

    this.protocolsSecurityConfig = protocolsSecurityConfig;
  }

  /**
   * Log a vault-related operation after deposit or withdraw funds
   * @param userAddress Address of the user who performed the operation
   * @param hash Hash of the operation
   * @param vaultInfo Information about the vault where the operation was performed
   * @param chainId Chain ID where the operation was performed
   * @param amount Amount of the operation
   * @param operationType Type of the operation
   * @param operationStatus Status of the operation
   */
  private async logOperation(
    userAddress: Address,
    hash: Hash,
    vaultInfo: VaultInfo,
    chainId: number,
    amount: string,
    operationType: 'deposit' | 'withdrawal',
    operationStatus: 'completed' | 'failed',
  ): Promise<void> {
    const apiResponse = await this.apiClient.sendRequest('log', undefined, undefined, {
      userAddress,
      protocolId: vaultInfo.protocolId,
      vaultAddress: vaultInfo.vaultAddress,
      transactionHash: hash,
      chainId: chainId.toString(),
      amount,
      status: operationStatus,
      operationType,
    });

    if (!apiResponse.success) {
      throw new Error(
        apiResponse.error || `Failed to log operation: ${operationType} for vault: ${vaultInfo}`,
      );
    }
  }

  /**
   * Get the best vaults to deposit funds
   * @param stableVaultsLimit Limit of stable vaults to get. Optional, default is 1
   * @param nonStableVaultsLimit Limit of non-stable vaults to get. Optional, default is 1
   * @returns Best vaults to deposit funds in 2 groups: stable and non-stable
   */
  async getBestVaults(
    stableVaultsLimit: number = 1,
    nonStableVaultsLimit: number = 1,
  ): Promise<Vaults> {
    const pathParams = {
      risk_level: this.protocolsSecurityConfig.riskLevel,
      chain_id: this.selectedChainId!.toString(),
      stable_vaults_limit: stableVaultsLimit.toString(),
      non_stable_vaults_limit: nonStableVaultsLimit.toString(),
    };

    const apiResponse = await this.apiClient.sendRequest('vaults', pathParams);

    if (!apiResponse.success) {
      throw new Error(apiResponse.error || 'Failed to get best vaults');
    }

    const vaults: ProxyVaults = apiResponse.data as unknown as ProxyVaults;

    return {
      stable: vaults.stableVaults.map((vault: VaultInfo): VaultInfo => {
        return {
          ...vault,
          metadata: {
            apy: vault.metadata?.apy,
            poolTvlUsd: vault.metadata?.poolTvlUsd,
          },
        } as VaultInfo;
      }),
      nonStable: vaults.nonStableVaults.map((vault: VaultInfo): VaultInfo => {
        return {
          ...vault,
          metadata: {
            apy: vault.metadata?.apy,
            poolTvlUsd: vault.metadata?.poolTvlUsd,
          },
        } as VaultInfo;
      }),
    };
  }

  /**
   * Deposit funds to a provided vault
   * @param vaultInfo Information about the vault to deposit funds to
   * @param amount Amount of funds to deposit
   * @param smartWallet Smart wallet to use for the deposit
   * @returns Result of the deposit transaction
   */
  async deposit(
    vaultInfo: VaultInfo,
    amount: string,
    smartWallet: SmartWallet,
    options?: { paymasterToken?: Address },
  ): Promise<VaultTxnResult> {
    const currentAddress = await smartWallet.getAddress();

    const operationsCallData = [];
    const depositTokenDecimals = vaultInfo.tokenDecimals;
    const depositTokenAddress = vaultInfo.tokenAddress;
    const vaultAddress = vaultInfo.vaultAddress;

    const rawDepositAmount = parseUnits(amount, depositTokenDecimals);

    // If paymaster token and deposit token are the same, reserve balance for gas
    if (
      options?.paymasterToken &&
      options.paymasterToken.toLowerCase() === depositTokenAddress.toLowerCase()
    ) {
      this.ensureInitialized();
      const publicClient = this.chainManager!.getPublicClient(this.selectedChainId!);
      const balance = await publicClient.readContract({
        address: depositTokenAddress,
        abi: erc20Abi,
        functionName: 'balanceOf',
        args: [currentAddress],
      });

      // Reserve ~1% for gas payment (minimum 1 unit)
      const gasReserve = balance / 100n > 0n ? balance / 100n : 1n;
      const maxDepositAmount = balance > gasReserve ? balance - gasReserve : 0n;

      if (rawDepositAmount > maxDepositAmount) {
        const maxDepositFormatted = Number(maxDepositAmount) / 10 ** depositTokenDecimals;
        throw new Error(
          `Insufficient balance. Must reserve tokens for gas payment. Max deposit: ${maxDepositFormatted.toFixed(depositTokenDecimals)}`,
        );
      }
    }

    const allowance = await this.checkAllowance(
      depositTokenAddress,
      vaultAddress,
      currentAddress,
      this.selectedChainId!,
    );

    if (allowance < rawDepositAmount) {
      const approveData = {
        to: depositTokenAddress,
        data: encodeFunctionData({
          abi: erc20Abi,
          functionName: 'approve',
          args: [vaultAddress, rawDepositAmount],
        }),
      };

      operationsCallData.push(approveData);
    }

    if (!vaultInfo.protocolId) {
      throw new Error('Vault protocol ID is required');
    }

    const apiResponse = await this.apiClient.sendRequest(
      'deposit',
      undefined,
      vaultInfo.protocolId,
      {
        vaultInfo,
        amount: amount.toString(),
        chainId: this.selectedChainId!.toString(),
      },
    );

    if (!apiResponse.success) {
      throw new Error(apiResponse.error || 'Failed to receive deposit operations call data');
    }

    const receivedOperationsCallData = apiResponse.data as unknown as OperationCallDataType;

    operationsCallData.push(receivedOperationsCallData);

    const hash = await smartWallet.sendBatch(operationsCallData, this.selectedChainId!, options);

    const operationStatus = hash ? 'completed' : ('failed' as 'completed' | 'failed');

    this.logOperation(
      currentAddress,
      hash,
      vaultInfo,
      this.selectedChainId!,
      amount,
      'deposit',
      operationStatus,
    );

    return { hash, success: true };
  }

  /**
   * Withdraw funds from a provided vault
   * @param vaultInfo Information about the vault to withdraw funds from
   * @param amount Amount of funds to withdraw
   * @param smartWallet Smart wallet to use for the withdrawal
   * @returns Result of the withdrawal transaction
   */
  async withdraw(
    vaultInfo: VaultInfo,
    amount: string,
    smartWallet: SmartWallet,
    options?: { paymasterToken?: Address },
  ): Promise<VaultTxnResult> {
    const currentAddress = await smartWallet.getAddress();
    const earningBalances = await smartWallet.getEarnBalances();

    const tokenDecimals = vaultInfo.tokenDecimals;
    const tokenAddress = vaultInfo.tokenAddress;

    if (!earningBalances) {
      throw new Error('No earning balances found');
    }

    const earningBalance = earningBalances.find((balance) => balance.vaultInfo.id === vaultInfo.id);

    if (!earningBalance) {
      throw new Error('No earning balance found');
    }
    const balanceInfo = earningBalance.balance as ProxyBalance;

    const amountToWithdraw = amount ? amount : balanceInfo.currentBalance;

    if (
      options?.paymasterToken &&
      options.paymasterToken.toLowerCase() === tokenAddress.toLowerCase()
    ) {
      this.ensureInitialized();
      const publicClient = this.chainManager!.getPublicClient(this.selectedChainId!);
      const walletBalance = await publicClient.readContract({
        address: tokenAddress,
        abi: erc20Abi,
        functionName: 'balanceOf',
        args: [currentAddress],
      });

      // Reserve ~1% for gas payment (minimum 1 unit)
      // The wallet must have enough balance BEFORE withdrawal to pay for gas
      const gasReserve = walletBalance / 100n > 0n ? walletBalance / 100n : 1n;
      const minRequiredBalance = gasReserve;

      if (walletBalance < minRequiredBalance) {
        const minRequiredFormatted = Number(minRequiredBalance) / 10 ** tokenDecimals;
        throw new Error(
          `Insufficient wallet balance for gas payment. Wallet needs at least ${minRequiredFormatted.toFixed(tokenDecimals)} tokens to pay for gas before withdrawal.`,
        );
      }
    }

    const apiResponse = await this.apiClient.sendRequest(
      'withdraw',
      undefined,
      vaultInfo.protocolId,
      {
        vaultInfo,
        amount: amountToWithdraw,
        chainId: this.selectedChainId!,
      },
    );

    if (!apiResponse.success) {
      throw new Error(apiResponse.error || 'Failed to receive withdraw operations call data');
    }

    const withdrawOperationCallData = apiResponse.data as unknown as OperationCallDataType;

    const hash = await smartWallet.send(withdrawOperationCallData, this.selectedChainId!, options);

    const operationStatus = hash ? 'completed' : ('failed' as 'completed' | 'failed');

    this.logOperation(
      currentAddress,
      hash,
      vaultInfo,
      this.selectedChainId!,
      amountToWithdraw,
      'withdrawal',
      operationStatus,
    );

    return { hash, success: true };
  }

  /**
   * Get the balances of a user by a provided address
   * @param walletAddress Address of the user to get the balances of
   * @param protocolId Protocol ID to get the balances for. Optional, default is undefined
   * @returns Balances of the user in the protocol vaults
   */
  async getBalances(walletAddress: Address, protocolId?: string): Promise<VaultBalance[]> {
    const pathParams = {
      chain_id: this.selectedChainId!.toString(),
      protocol_id: protocolId || '',
      userAddress: walletAddress,
    };

    const apiResponse = await this.apiClient.sendRequest('balances', pathParams);

    if (!apiResponse.success) {
      throw new Error(apiResponse.error || 'Failed to get balances');
    }

    const balances: VaultBalance[] = apiResponse.data as unknown as VaultBalance[];

    return balances;
  }
}
