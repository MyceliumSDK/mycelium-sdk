import { vi } from 'vitest';
import type { ChainManager } from '@/tools/ChainManager';
import type { PublicClient } from 'viem';
import type { SupportedChainId } from '@/constants/chains';

/**
 * Mock Chain Manager for testing
 *  Provides a mock implementation of ChainManager for testing purposes
 */
export const createMockChainManager = (): ChainManager => {
  const mockPublicClient = {
    readContract: vi.fn(),
    getBalance: vi.fn(),
    waitForTransactionReceipt: vi.fn(),
  } as unknown as PublicClient;

  const mockBundlerClient = {
    sendUserOperation: vi.fn(),
    waitForUserOperationReceipt: vi.fn(),
    estimateUserOperationGas: vi.fn().mockResolvedValue({
      callGasLimit: BigInt(100000),
      verificationGasLimit: BigInt(100000),
      preVerificationGas: BigInt(100000),
    }),
  };
  return {
    getPublicClient: vi.fn().mockReturnValue(mockPublicClient),
    getRpcUrl: vi.fn().mockReturnValue('https://mock-rpc-url.com'),
    getBundlerUrl: vi.fn().mockReturnValue('https://mock-bundler-url.com'),
    getBundlerClient: vi.fn().mockReturnValue(mockBundlerClient),
    getChain: vi.fn().mockReturnValue({
      id: 8453,
      name: 'Base',
      network: 'base',
      nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
      rpcUrls: { default: { http: ['https://mock-rpc-url.com'] } },
    }),
    getSupportedChain: vi.fn().mockReturnValue(8453 as SupportedChainId),
  } as unknown as ChainManager;
};
