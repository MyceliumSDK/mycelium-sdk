import { vi } from 'vitest';
import { createMockChainManager } from '@/test/mocks/ChainManagerMock';
import { SPARK_VAULT } from '@/protocols/constants/spark';
import type { BaseProtocol } from '@/protocols/base/BaseProtocol';
/**
 * Mock Protocol for testing
 *  Provides a mock implementation of Protocol for testing purposes
 */
export const createMockProtocol = (): BaseProtocol => {
  const mockChainManager = createMockChainManager();

  return {
    init: vi.fn(),
    chainManager: mockChainManager,
    getVaults: vi.fn().mockResolvedValue(SPARK_VAULT),
    getBestVault: vi.fn().mockResolvedValue(SPARK_VAULT[0]),
    fetchDepositedVaults: vi.fn().mockResolvedValue(SPARK_VAULT[0]),
    deposit: vi.fn().mockResolvedValue({
      hash: '0x3c36293ab6884794bda1271b570ca9e9b68a406e93486359e7213a30f88c349b',
      success: true,
    }),
    withdraw: vi.fn().mockResolvedValue({
      hash: '0x3c36293ab6884794bda1271b570ca9e9b68a406e93486359e7213a30f88c349b',
      success: true,
    }),
    getBalances: vi.fn().mockResolvedValue([{ balance: '100', vaultInfo: SPARK_VAULT[0] }]),
    approveToken: vi
      .fn()
      .mockResolvedValue('0x3c36293ab6884794bda1271b570ca9e9b68a406e93486359e7213a30f88c349b'),
    checkAllowance: vi.fn().mockResolvedValue(100n),
  } as unknown as BaseProtocol;
};
