import { type Address, encodeFunctionData, erc20Abi, http, type Hex } from 'viem';
import {
  type BundlerClient,
  type ToCoinbaseSmartAccountReturnType,
  type UserOperationRequest,
} from 'viem/account-abstraction';
import { createSmartAccountClient, type SmartAccountClient } from 'permissionless';
import type { PimlicoClient } from 'permissionless/clients/pimlico';
import { describe, it, expect, vi, beforeEach, type Mock } from 'vitest';

import { ERC20_PAYMASTER_ADDRESS } from '@mycelium-sdk/core/constants/paymaster';
import type { SupportedChainId } from '@mycelium-sdk/core/constants/chains';
import { createMockChainManager } from '@mycelium-sdk/core/test/mocks/ChainManagerMock';
import type { ChainManager } from '@mycelium-sdk/core/tools/ChainManager';
import type { TransactionData } from '@mycelium-sdk/core/types/transaction';

import { Paymaster } from '@mycelium-sdk/core/tools/Paymaster';

vi.mock('permissionless', () => ({
  createSmartAccountClient: vi.fn(),
}));

vi.mock('viem', async () => {
  // @ts-ignore - importActual returns unknown
  const actual = await vi.importActual('viem');
  return {
    ...actual,
    http: vi.fn(() => ({ __transport: 'http' })),
    encodeFunctionData: vi.fn(),
  };
});

describe('Paymaster', () => {
  let paymaster: Paymaster;
  let chainManager: ChainManager;
  let mockPublicClient: {
    readContract: Mock;
  };
  let mockPimlicoClient: PimlicoClient;
  let mockSmartAccountClient: SmartAccountClient;

  const chainId: SupportedChainId = 8453;
  const walletAddress: Address = '0x1234567890123456789012345678901234567890';
  const paymasterToken: Address = '0xabcdef1234567890abcdef1234567890abcdef12';
  const validTransactionData: TransactionData = {
    to: walletAddress,
    data: '0x1234' as Hex,
    value: 1000n,
  };

  beforeEach(() => {
    vi.clearAllMocks();

    chainManager = createMockChainManager();
    mockPublicClient = chainManager.getPublicClient(chainId) as any;
    mockPimlicoClient = {
      getUserOperationGasPrice: vi.fn().mockResolvedValue({
        fast: {
          maxFeePerGas: 1000000000n,
          maxPriorityFeePerGas: 100000000n,
        },
      }),
    } as unknown as PimlicoClient;

    mockSmartAccountClient = {
      sendTransaction: vi.fn().mockResolvedValue('0xhash' as Hex),
    } as unknown as SmartAccountClient;

    // Setup ChainManager mocks - add getPaymasterClient to the mock
    (chainManager as any).getPaymasterClient = vi.fn().mockReturnValue(mockPimlicoClient);
    vi.mocked(chainManager.getChain).mockReturnValue({
      id: chainId,
      name: 'Base',
    } as any);
    vi.mocked(chainManager.getBundlerUrl).mockReturnValue('https://bundler.example.com');

    // Setup permissionless mock
    vi.mocked(createSmartAccountClient).mockReturnValue(mockSmartAccountClient);

    // Setup viem mocks
    vi.mocked(encodeFunctionData).mockReturnValue('0xApprove' as Hex);

    paymaster = new Paymaster(chainManager);
  });

  describe('prepareCallsWithApproval', () => {
    it('should return approval transaction when allowance is 0', async () => {
      vi.mocked(mockPublicClient.readContract).mockResolvedValue(0n);

      const result = await paymaster.prepareCallsWithApproval(
        validTransactionData,
        paymasterToken,
        walletAddress,
        chainId,
      );

      expect(mockPublicClient.readContract).toHaveBeenCalledWith({
        address: paymasterToken,
        abi: erc20Abi,
        functionName: 'allowance',
        args: [walletAddress, ERC20_PAYMASTER_ADDRESS],
      });

      expect(result.calls).toHaveLength(2);
      expect(result.calls[0]?.to).toBe(paymasterToken);
      expect(result.calls[0]?.value).toBe(0n);
      expect(result.calls[1]).toEqual(validTransactionData);
      expect(result.paymasterContext.token).toBe(paymasterToken);
    });

    it('should skip approval transaction when allowance is greater than 0', async () => {
      vi.mocked(mockPublicClient.readContract).mockResolvedValue(1000000n);

      const result = await paymaster.prepareCallsWithApproval(
        validTransactionData,
        paymasterToken,
        walletAddress,
        chainId,
      );

      expect(result.calls).toHaveLength(1);
      expect(result.calls[0]).toEqual(validTransactionData);
      expect(result.paymasterContext.token).toBe(paymasterToken);
    });

    it('should handle array of transaction data', async () => {
      vi.mocked(mockPublicClient.readContract).mockResolvedValue(0n);

      const transactionArray: TransactionData[] = [
        validTransactionData,
        {
          to: walletAddress,
          data: '0x5678' as Hex,
        },
      ];

      const result = await paymaster.prepareCallsWithApproval(
        transactionArray,
        paymasterToken,
        walletAddress,
        chainId,
      );

      expect(result.calls).toHaveLength(3); // approval + 2 transactions
      expect(result.calls[0]?.to).toBe(paymasterToken);
      expect(result.calls[1]).toEqual(transactionArray[0]);
      expect(result.calls[2]).toEqual(transactionArray[1]);
    });

    it('should encode approval with maxUint256 when allowance is 0', async () => {
      vi.mocked(mockPublicClient.readContract).mockResolvedValue(0n);

      await paymaster.prepareCallsWithApproval(
        validTransactionData,
        paymasterToken,
        walletAddress,
        chainId,
      );

      expect(encodeFunctionData).toHaveBeenCalledWith({
        abi: erc20Abi,
        functionName: 'approve',
        args: [ERC20_PAYMASTER_ADDRESS, expect.any(BigInt)],
      });
    });

    it('should return correct PreparedCalls structure', async () => {
      vi.mocked(mockPublicClient.readContract).mockResolvedValue(0n);

      const result = await paymaster.prepareCallsWithApproval(
        validTransactionData,
        paymasterToken,
        walletAddress,
        chainId,
      );

      expect(result).toHaveProperty('calls');
      expect(result).toHaveProperty('paymasterContext');
      expect(result.paymasterContext).toHaveProperty('token');
      expect(Array.isArray(result.calls)).toBe(true);
    });
  });

  describe('createSmartAccountClient', () => {
    const mockAccount = {} as ToCoinbaseSmartAccountReturnType;

    it('should create smart account client with correct configuration', () => {
      const client = paymaster.createSmartAccountClient(mockAccount, chainId);

      expect(chainManager.getPaymasterClient).toHaveBeenCalledWith(chainId);
      expect(chainManager.getChain).toHaveBeenCalledWith(chainId);
      expect(chainManager.getBundlerUrl).toHaveBeenCalledWith(chainId);
      expect(http).toHaveBeenCalledWith('https://bundler.example.com');
      expect(createSmartAccountClient).toHaveBeenCalledWith(
        expect.objectContaining({
          account: mockAccount,
          chain: expect.any(Object),
          bundlerTransport: expect.any(Object),
          paymaster: mockPimlicoClient,
          userOperation: expect.objectContaining({
            estimateFeesPerGas: expect.any(Function),
          }),
        }),
      );
      expect(client).toBe(mockSmartAccountClient);
    });

    it('should throw error when paymaster client is not available', () => {
      vi.mocked(chainManager.getPaymasterClient).mockReturnValue(undefined);

      expect(() => paymaster.createSmartAccountClient(mockAccount, chainId)).toThrow(
        'Paymaster client is not available. Probably the paymaster URL is not configured for this chain',
      );
    });

    it('should throw error when bundler URL is not configured', () => {
      vi.mocked(chainManager.getBundlerUrl).mockReturnValue(undefined);

      expect(() => paymaster.createSmartAccountClient(mockAccount, chainId)).toThrow(
        `Bundler URL not configured for chain ID: ${chainId}`,
      );
    });

    it('should bump gas prices by 20% in estimateFeesPerGas', async () => {
      paymaster.createSmartAccountClient(mockAccount, chainId);
      const config =
        vi.mocked(createSmartAccountClient).mock.calls[
          vi.mocked(createSmartAccountClient).mock.calls.length - 1
        ]?.[0];
      const estimateFees = config?.userOperation?.estimateFeesPerGas;

      if (!estimateFees) {
        throw new Error('estimateFeesPerGas not found');
      }

      const fees = await estimateFees({
        account: undefined,
        bundlerClient: {} as BundlerClient,
        userOperation: {} as UserOperationRequest,
      });

      expect(fees.maxFeePerGas).toBe(1200000000n); // 1000000000n * 1.2
      expect(fees.maxPriorityFeePerGas).toBe(120000000n); // 100000000n * 1.2
    });
  });

  describe('sendWithERC20Paymaster', () => {
    const mockAccount = {} as ToCoinbaseSmartAccountReturnType;

    it('should send transaction with approval when needed', async () => {
      vi.mocked(mockPublicClient.readContract).mockResolvedValue(0n);

      const result = await paymaster.sendWithERC20Paymaster(
        validTransactionData,
        mockAccount,
        walletAddress,
        chainId,
        paymasterToken,
      );

      expect(mockSmartAccountClient.sendTransaction).toHaveBeenCalledWith({
        calls: expect.arrayContaining([
          expect.objectContaining({
            to: paymasterToken,
            data: '0xApprove',
            value: 0n,
          }),
          expect.objectContaining({
            to: walletAddress,
            data: '0x1234',
            value: 1000n,
          }),
        ]),
        paymasterContext: {
          token: paymasterToken,
        },
      });
      expect(result).toBe('0xhash');
    });

    it('should send transaction without approval when allowance exists', async () => {
      vi.mocked(mockPublicClient.readContract).mockResolvedValue(1000000n);

      const result = await paymaster.sendWithERC20Paymaster(
        validTransactionData,
        mockAccount,
        walletAddress,
        chainId,
        paymasterToken,
      );

      expect(mockSmartAccountClient.sendTransaction).toHaveBeenCalledWith({
        calls: [
          expect.objectContaining({
            to: walletAddress,
            data: '0x1234',
            value: 1000n,
          }),
        ],
        paymasterContext: {
          token: paymasterToken,
        },
      });
      expect(result).toBe('0xhash');
    });

    it('should handle array of transactions', async () => {
      vi.mocked(mockPublicClient.readContract).mockResolvedValue(0n);

      const transactionArray: TransactionData[] = [
        validTransactionData,
        {
          to: walletAddress,
          data: '0x5678' as Hex,
        },
      ];

      await paymaster.sendWithERC20Paymaster(
        transactionArray,
        mockAccount,
        walletAddress,
        chainId,
        paymasterToken,
      );

      expect(mockSmartAccountClient.sendTransaction).toHaveBeenCalledWith({
        calls: expect.arrayContaining([
          expect.objectContaining({ to: paymasterToken }),
          expect.objectContaining({ to: walletAddress, data: '0x1234' }),
          expect.objectContaining({ to: walletAddress, data: '0x5678' }),
        ]),
        paymasterContext: {
          token: paymasterToken,
        },
      });
    });

    it('should map transaction value to 0n when undefined', async () => {
      vi.mocked(mockPublicClient.readContract).mockResolvedValue(1000000n);

      const txWithoutValue: TransactionData = {
        to: walletAddress,
        data: '0x1234' as Hex,
      };

      await paymaster.sendWithERC20Paymaster(
        txWithoutValue,
        mockAccount,
        walletAddress,
        chainId,
        paymasterToken,
      );

      expect(mockSmartAccountClient.sendTransaction).toHaveBeenCalledWith({
        calls: [
          expect.objectContaining({
            to: walletAddress,
            data: '0x1234',
            value: 0n,
          }),
        ],
        paymasterContext: {
          token: paymasterToken,
        },
      });
    });
  });

  describe('Error Handling', () => {
    const mockAccount = {} as ToCoinbaseSmartAccountReturnType;

    it('should propagate error from prepareCallsWithApproval', async () => {
      vi.mocked(mockPublicClient.readContract).mockRejectedValue(new Error('Contract read failed'));

      await expect(
        paymaster.sendWithERC20Paymaster(
          validTransactionData,
          mockAccount,
          walletAddress,
          chainId,
          paymasterToken,
        ),
      ).rejects.toThrow('Contract read failed');
    });

    it('should propagate error from createSmartAccountClient', () => {
      vi.mocked(chainManager.getPaymasterClient).mockReturnValue(undefined);

      expect(() => paymaster.createSmartAccountClient(mockAccount, chainId)).toThrow();
    });
  });
});
