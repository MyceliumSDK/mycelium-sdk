import { type Address, encodeFunctionData, erc20Abi, http, type Hex, maxUint256 } from 'viem';
import { type ToCoinbaseSmartAccountReturnType } from 'viem/account-abstraction';
import { createSmartAccountClient, type SmartAccountClient } from 'permissionless';
import type { PimlicoClient } from 'permissionless/clients/pimlico';

import type { SupportedChainId } from '@/constants/chains';
import { ERC20_PAYMASTER_ADDRESS } from '@/constants/paymaster';
import type { ChainManager } from '@/tools/ChainManager';
import type { TransactionData } from '@/types/transaction';
import type { PreparedCalls } from '@/types/paymaster';

/**
 * Service for managing ERC-20 paymaster operations
 *
 * @internal
 * @category Infrastructure
 * @remarks
 * Handles paymaster client creation, approval transactions, and paymaster context preparation
 * Supports ERC-20 token paymasters via Pimlico (other paymasters are not supported yet)
 */
export class Paymaster {
  private chainManager: ChainManager;

  constructor(chainManager: ChainManager) {
    this.chainManager = chainManager;
  }

  /**
   * Gets paymaster client for the specified chain
   * @private
   */
  private getPaymasterClient(chainId: SupportedChainId): PimlicoClient {
    const pimlicoClient = this.chainManager.getPaymasterClient(chainId);
    if (!pimlicoClient) {
      throw new Error(
        'Paymaster client is not available. Probably the paymaster URL is not configured for this chain',
      );
    }
    return pimlicoClient;
  }

  /**
   * Prepares approval transaction if needed for ERC-20 paymaster
   * @private
   */
  private async preparePaymasterApproval(
    paymasterToken: Address,
    walletAddress: Address,
    chainId: SupportedChainId,
  ): Promise<TransactionData | null> {
    const publicClient = this.chainManager.getPublicClient(chainId);

    const allowance = await publicClient.readContract({
      address: paymasterToken,
      abi: erc20Abi,
      functionName: 'allowance',
      args: [walletAddress, ERC20_PAYMASTER_ADDRESS],
    });

    if (allowance > 0n) {
      return null;
    }

    return {
      to: paymasterToken,
      value: 0n,
      data: encodeFunctionData({
        abi: erc20Abi,
        functionName: 'approve',
        args: [ERC20_PAYMASTER_ADDRESS, maxUint256],
      }),
    };
  }

  /**
   * Prepares calls array with approval if needed for ERC-20 paymaster
   */
  async prepareCallsWithApproval(
    transactionData: TransactionData | TransactionData[],
    paymasterToken: Address,
    walletAddress: Address,
    chainId: SupportedChainId,
  ): Promise<PreparedCalls> {
    const approvalTx = await this.preparePaymasterApproval(paymasterToken, walletAddress, chainId);

    const calls = Array.isArray(transactionData) ? transactionData : [transactionData];
    const callsWithApproval = approvalTx ? [approvalTx, ...calls] : calls;

    return {
      calls: callsWithApproval,
      paymasterContext: {
        token: paymasterToken,
      },
    };
  }

  /**
   * Creates a SmartAccountClient configured with ERC-20 paymaster
   */
  createSmartAccountClient(
    account: ToCoinbaseSmartAccountReturnType,
    chainId: SupportedChainId,
  ): SmartAccountClient {
    const pimlicoClient = this.getPaymasterClient(chainId);
    const chain = this.chainManager.getChain(chainId);
    const bundlerUrl = this.chainManager.getBundlerUrl(chainId);

    if (!bundlerUrl) {
      throw new Error(`Bundler URL not configured for chain ID: ${chainId}`);
    }

    return createSmartAccountClient({
      account,
      chain,
      bundlerTransport: http(bundlerUrl),
      paymaster: pimlicoClient,
      userOperation: {
        estimateFeesPerGas: async () => {
          const gasPrice = await pimlicoClient.getUserOperationGasPrice();
          const bump = (value: bigint, pct = 20n) => value + (value * pct) / 100n;

          return {
            maxFeePerGas: bump(gasPrice.fast.maxFeePerGas),
            maxPriorityFeePerGas: bump(gasPrice.fast.maxPriorityFeePerGas),
          };
        },
      },
    });
  }

  /**
   * Sends transaction(s) with ERC-20 paymaster
   */
  async sendWithERC20Paymaster(
    transactionData: TransactionData | TransactionData[],
    account: ToCoinbaseSmartAccountReturnType,
    walletAddress: Address,
    chainId: SupportedChainId,
    paymasterToken: Address,
  ): Promise<Hex> {
    const smartAccountClient = this.createSmartAccountClient(account, chainId);
    const { calls, paymasterContext } = await this.prepareCallsWithApproval(
      transactionData,
      paymasterToken,
      walletAddress,
      chainId,
    );

    return smartAccountClient.sendTransaction({
      calls: calls.map((call) => ({
        to: call.to as `0x${string}`,
        data: call.data as `0x${string}`,
        value: call.value ?? 0n,
      })),
      paymasterContext,
    });
  }
}
