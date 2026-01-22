import { BaseProtocol } from '@/protocols/base/BaseProtocol';
import type { ChainManager } from '@/tools/ChainManager';
import type { SmartWallet } from '@/wallet/base/wallets/SmartWallet';

import {
  type Address,
  encodeFunctionData,
  erc20Abi,
  formatUnits,
  maxUint256,
  parseUnits,
} from 'viem';

import { SPARK_VAULT_ABI, SPARK_SSR_ORACLE_ABI } from '@/abis/protocols/spark';
import {
  RAY,
  SECONDS_PER_YEAR,
  SPARK_SSR_ORACLE_ADDRESS,
  SPARK_VAULT,
} from '@/protocols/constants/spark';
import type { VaultBalance, VaultInfo, Vaults, VaultTxnResult } from '@/types/protocols/general';

/**
 * @internal
 * @category Protocols
 * @class SparkProtocol
 * @classdesc
 * Internal implementation of the Spark Protocol adapter
 * Provides ERC-4626 vault management including deposits, withdrawals, and balance tracking
 * Used by the SDK to interact with Spark-based yield vaults
 */
export class SparkProtocol extends BaseProtocol {
  /** All Spark vaults */
  private allVaults: VaultInfo[] = [];

  /**
   * Initialize the Spark protocol with the provided chain manager
   * @param chainManager Chain manager instance used for network operations
   */
  async init(chainManager: ChainManager): Promise<void> {
    this.chainManager = chainManager;
    this.selectedChainId = chainManager.getSupportedChain();

    this.publicClient = chainManager.getPublicClient(this.selectedChainId!);

    this.allVaults = SPARK_VAULT;
  }

  /**
   * Get the SSR (Sky Saving Rate) of the Spark protocol
   * @remarks
   * The parameter ius necessary to calculate the APY of a vault
   * @returns
   */
  private async getSSR(): Promise<number> {
    if (!this.publicClient) {
      throw new Error('Public client not initialized');
    }

    const ssrRaw = await this.publicClient.readContract({
      address: SPARK_SSR_ORACLE_ADDRESS,
      abi: SPARK_SSR_ORACLE_ABI,
      functionName: 'getSSR',
    });

    const ssr = Number(ssrRaw) / Number(RAY);
    return ssr;
  }

  /**
   * Get the APY of the Spark protocol
   * @remarks
   * Calculation based on the formula from the documentation:
   * https://docs.spark.fi/dev/integration-guides/susds-lending-market#rates
   * @returns The APY of the Spark protocol in percentage
   */
  async getAPY(): Promise<number> {
    const ssr = await this.getSSR();

    const apy = Math.exp(Math.log(ssr) * SECONDS_PER_YEAR) - 1;

    return apy;
  }

  /**
   * Get the best available Spark vaults
   * @remarks Currently, the vault is only one and relates to sUSDC. Currently return only one stable vault
   * @returns Best Spark vaults in 2 groups: stable and non-stable
   * @throws Error if no vaults found
   */
  async getBestVaults(): Promise<Vaults> {
    if (this.allVaults.length === 0) {
      throw new Error('No vaults found');
    }

    // Currently, the vault is only one and relates to sUSDC
    // More Spark vaults can be added in the future, but the APY calculation will remain the same
    const selectedVault = this.allVaults[0]!;

    // The APY for Spark vaults calculates the same for all vaults
    selectedVault.metadata!.apy = await this.getAPY();

    return {
      stable: [selectedVault],
      nonStable: [],
    };
  }

  /**
   * Deposit funds into a Spark vault
   * @param vaultInfo Vault information
   * @param amount Amount to deposit (human-readable)
   * @param smartWallet Smart wallet instance to use
   * @returns Transaction result with hash
   */
  async deposit(
    vaultInfo: VaultInfo,
    amount: string,
    smartWallet: SmartWallet,
    options?: { paymasterToken?: Address },
  ): Promise<VaultTxnResult> {
    const currentAddress = await smartWallet.getAddress();
    const depositTokenDecimals = vaultInfo.tokenDecimals;
    const depositTokenAddress = vaultInfo.tokenAddress;
    const vaultAddress = vaultInfo.vaultAddress;

    const rawDepositAmount = parseUnits(amount, vaultInfo.tokenDecimals);

    const operationsCallData = [];

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

    const depositData = {
      to: vaultAddress,
      data: encodeFunctionData({
        abi: SPARK_VAULT_ABI,
        functionName: 'deposit',
        args: [rawDepositAmount, currentAddress] as const,
      }),
    };

    operationsCallData.push(depositData);

    const hash = await smartWallet.sendBatch(operationsCallData, this.selectedChainId!, options);
    return { success: true, hash };
  }

  /**
   * Withdraw funds from a Spark vault
   * @param vaultInfo Vault information
   * @param amount Amount in base token units (or undefined to withdraw all)
   * @param smartWallet Smart wallet instance to withdraw from
   * @returns Transaction result with hash
   * @throws Error if no deposited vault found
   */
  async withdraw(
    vaultInfo: VaultInfo,
    amount: string | undefined,
    smartWallet: SmartWallet,
    options?: { paymasterToken?: Address },
  ): Promise<VaultTxnResult> {
    const currentAddress = await smartWallet.getAddress();

    const tokenDecimals = vaultInfo.tokenDecimals;
    const tokenAddress = vaultInfo.tokenAddress;
    const vaultAddress = vaultInfo.vaultAddress;

    const operationsCallData = [];

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

    // Check allowance of sUSDC shares (vaultAddress) for the vault (vaultAddress)
    // In ERC-4626, the vault contract IS the share token
    const allowance = await this.checkAllowance(
      vaultAddress, // sUSDC shares token address (same as vault)
      vaultAddress, // vault address (needs approval to spend shares)
      currentAddress,
      this.selectedChainId!,
    );

    // Approve vault to spend sUSDC shares if needed
    if (allowance === 0n) {
      const approveData = {
        to: vaultAddress, // sUSDC share token
        data: encodeFunctionData({
          abi: erc20Abi,
          functionName: 'approve',
          args: [vaultAddress, maxUint256], // Approve vault to spend shares
        }),
      };
      operationsCallData.push(approveData);
    }

    let withdrawCallData;
    if (amount) {
      const rawWithdrawAmount = parseUnits(amount, tokenDecimals);

      withdrawCallData = {
        to: vaultAddress,
        data: encodeFunctionData({
          abi: SPARK_VAULT_ABI,
          functionName: 'withdraw',
          args: [rawWithdrawAmount, currentAddress, currentAddress] as const,
        }),
      };
    } else {
      const maxShares = await this.getMaxRedeemableShares(vaultInfo, currentAddress);

      withdrawCallData = {
        to: vaultAddress,
        data: encodeFunctionData({
          abi: SPARK_VAULT_ABI,
          functionName: 'redeem',
          args: [maxShares, currentAddress, currentAddress] as const,
        }),
      };
    }

    operationsCallData.push(withdrawCallData);

    const hash = await smartWallet.sendBatch(operationsCallData, this.selectedChainId!, options);

    return { success: true, hash };
  }

  /**
   * Get the maximum redeemable shares for a wallet
   * @param vaultInfo Vault information
   * @param walletAddress Wallet address to check
   * @returns Maximum redeemable shares as bigint
   */
  private async getMaxRedeemableShares(
    vaultInfo: VaultInfo,
    walletAddress: Address,
  ): Promise<bigint> {
    if (!this.publicClient) {
      throw new Error('Public client not initialized');
    }

    const shares = await this.publicClient.readContract({
      address: vaultInfo.vaultAddress,
      abi: SPARK_VAULT_ABI,
      functionName: 'balanceOf',
      args: [walletAddress],
    });

    return shares;
  }

  /**
   * Get amount that a wallet has deposited in a vault
   * @param walletAddress Wallet address to check
   * @returns Array of vault balances with vaults info
   */
  async getBalances(walletAddress: Address): Promise<VaultBalance[]> {
    if (!this.publicClient) {
      throw new Error('Public client not initialized');
    }

    // TODO: Support multiple options of Spark vaults
    // Use just one spark vault in this implementation
    const vaultInfo = SPARK_VAULT[0]!;
    vaultInfo.metadata!.apy = await this.getAPY();

    const shares = await this.publicClient.readContract({
      address: vaultInfo.vaultAddress,
      abi: SPARK_VAULT_ABI,
      functionName: 'balanceOf',
      args: [walletAddress],
    });

    if (shares === 0n) {
      return [{ balance: null, vaultInfo }];
    }

    const assets = await this.publicClient.readContract({
      address: vaultInfo.vaultAddress,
      abi: SPARK_VAULT_ABI,
      functionName: 'convertToAssets',
      args: [shares],
    });

    return [
      {
        balance: formatUnits(assets, vaultInfo.tokenDecimals),
        vaultInfo,
      },
    ];
  }
}
