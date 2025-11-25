import { BaseProtocol } from '@/protocols/base/BaseProtocol';
import type { ChainManager } from '@/tools/ChainManager';
import type { VaultBalance, VaultInfo, Vaults, VaultTxnResult } from '@/types/protocols/general';
import axios, { type AxiosInstance, type AxiosResponse, type Method } from 'axios';
import { BACKEND_HOSTNAME } from '@/constants/general';
import type {
  LogOperationDataResponse,
  OperationCallDataType,
  ProxyVaults,
  ProxyVaultsResponse,
} from '@/types/protocols/proxy';
import type { ApiResponse, RequestSettings } from '@/types/api';
import { encodeFunctionData, erc20Abi, parseUnits, type Address, type Hash } from 'viem';
import type { SmartWallet } from '@/public/types';

export class ProxyProtocol extends BaseProtocol {
  private readonly client: AxiosInstance = axios.create({
    baseURL: BACKEND_HOSTNAME,
  });

  /** URL settings for the endpoint: get the best vaults to deposit funds */
  private readonly bestVaultUrlSettings: RequestSettings = {
    method: 'GET',
    path: 'api/v1/public/protocols/best',
  };

  /** URL settings for the endpoint: deposit funds to a provided vault */
  private readonly depositUrlSettings: RequestSettings = {
    method: 'POST',
    path: 'api/v1/public/protocols/details/:protocolId/deposit',
  };

  /** URL settings for the endpoint: log a vault-related operation after deposit or withdraw funds */
  private readonly logOperationSettings: RequestSettings = {
    method: 'POST',
    path: 'api/v1/public/log/operation',
  };

  /** URL settings for the endpoint: withdraw funds from a provided vault */
  private readonly withdrawUrlSettings: RequestSettings = {
    method: 'POST',
    path: 'api/v1/public/protocols/details/:protocolId/withdraw',
  };

  /** URL settings for the endpoint: get the balances of a user by a provided address */
  private readonly balancesUrlSettings: RequestSettings = {
    method: 'GET',
    path: 'api/v1/public/protocols/details/:protocolId/balances',
  };

  /** API key for the backend API */
  private apiKey: string | undefined;

  /**
   * Initialize the Spark protocol with the provided chain manager
   * @param chainManager Chain manager instance used for network operations
   */
  async init(chainManager: ChainManager, apiKey: string): Promise<void> {
    this.chainManager = chainManager;
    this.selectedChainId = chainManager.getSupportedChain();

    this.publicClient = chainManager.getPublicClient(this.selectedChainId!);

    this.apiKey = apiKey;
  }

  /**
   * Send a request to the backend API
   * @param path Path of the endpoint to send the request to
   * @param method Method of the request
   * @param body Body of the request
   * @returns Response from the backend API
   */
  private async sendRequest(
    path: string,
    method: Method,
    body?: Record<string, string | VaultInfo>,
  ): Promise<ApiResponse<unknown>> {
    const response: AxiosResponse<ApiResponse<ProxyVaultsResponse>> = await this.client.request({
      method,
      url: path,
      data: body,
      headers: { Authorization: this.apiKey, 'Content-Type': 'application/json' },
    });

    if (response.status !== 200) {
      throw new Error(`Failed to send request to ${path}`);
    }

    const apiResponse = response.data as ApiResponse<unknown>;

    return apiResponse;
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
    operationType: 'deposit' | 'withdraw',
    operationStatus: 'completed' | 'failed',
  ): Promise<void> {
    const requestPath = `${this.logOperationSettings.path}`;
    const requestMethod = this.logOperationSettings.method;
    const apiResponse = await this.sendRequest(requestPath, requestMethod, {
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

    apiResponse.data as unknown as LogOperationDataResponse;
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
    const pathParams = new URLSearchParams({
      chain_id: this.selectedChainId!.toString(),
      stable_vaults_limit: stableVaultsLimit.toString(),
      non_stable_vaults_limit: nonStableVaultsLimit.toString(),
    });

    const requestPath = `${this.bestVaultUrlSettings.path}?${pathParams.toString()}`;
    const requestMethod = this.bestVaultUrlSettings.method;

    const apiResponse = await this.sendRequest(requestPath, requestMethod);

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
  ): Promise<VaultTxnResult> {
    const currentAddress = await smartWallet.getAddress();

    const operationsCallData = [];
    const depositTokenDecimals = vaultInfo.tokenDecimals;
    const depositTokenAddress = vaultInfo.tokenAddress;
    const vaultAddress = vaultInfo.vaultAddress;

    const rawDepositAmount = parseUnits(amount, depositTokenDecimals);

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

    const requestPath = `${this.depositUrlSettings.path.replace(':protocolId', vaultInfo.protocolId)}`;
    const requestMethod = this.depositUrlSettings.method;

    const apiResponse = await this.sendRequest(requestPath, requestMethod, {
      vaultInfo,
      amount,
      chainId: this.selectedChainId!.toString(),
    });

    if (!apiResponse.success) {
      throw new Error(apiResponse.error || 'Failed to receive deposit operations call data');
    }

    const receivedOperationsCallData = apiResponse.data as unknown as OperationCallDataType[];

    operationsCallData.push(...receivedOperationsCallData);

    const hash = await smartWallet.sendBatch(operationsCallData, this.selectedChainId!);

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
  ): Promise<VaultTxnResult> {
    const currentAddress = await smartWallet.getAddress();
    const requestPath = `${this.withdrawUrlSettings.path.replace(':protocolId', vaultInfo.protocolId)}`;
    const requestMethod = this.withdrawUrlSettings.method;

    const apiResponse = await this.sendRequest(requestPath, requestMethod, {
      vaultInfo,
      amount,
      chainId: this.selectedChainId!.toString(),
    });

    if (!apiResponse.success) {
      throw new Error(apiResponse.error || 'Failed to receive withdraw operations call data');
    }

    const withdrawOperationCallData = apiResponse.data as unknown as OperationCallDataType;

    const hash = await smartWallet.send(withdrawOperationCallData, this.selectedChainId!);

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
   * Get the balances of a user by a provided address
   * @param walletAddress Address of the user to get the balances of
   * @param protocolId Protocol ID to get the balances for. Optional, default is undefined
   * @returns Balances of the user in the protocol vaults
   */
  async getBalances(walletAddress: Address, protocolId?: string): Promise<VaultBalance[]> {
    const pathParams = new URLSearchParams({
      chain_id: this.selectedChainId!.toString(),
      protocol_id: protocolId || '',
      user_address: walletAddress,
    });

    const requestPath = `${this.balancesUrlSettings.path}?${pathParams.toString()}`;
    const requestMethod = this.balancesUrlSettings.method;

    const apiResponse = await this.sendRequest(requestPath, requestMethod);

    if (!apiResponse.success) {
      throw new Error(apiResponse.error || 'Failed to get balances');
    }

    const balances: VaultBalance[] = apiResponse.data as unknown as VaultBalance[];

    return balances;
  }
}
