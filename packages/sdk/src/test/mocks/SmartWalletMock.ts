import { vi } from 'vitest';
import type { SmartWallet } from '@/wallet/base/wallets/SmartWallet';
import type { Address, Hash } from 'viem';
import type { TransactionData } from '@/types/transaction';

/**
 * Mock Smart Wallet for testing
 *  Provides a mock implementation of SmartWallet for testing purposes
 */
export const createMockSmartWallet = (): SmartWallet => {
  return {
    getAddress: vi.fn().mockResolvedValue('0x1234567890123456789012345678901234567890' as Address),
    getBalance: vi.fn().mockResolvedValue([]),
    send: vi
      .fn()
      .mockResolvedValue(
        '0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890' as Hash,
      ),
    sendBatch: vi
      .fn()
      .mockResolvedValue(
        '0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890' as Hash,
      ),
    sendTokens: vi.fn().mockResolvedValue({} as TransactionData),
    earn: vi.fn().mockResolvedValue({ hash: '0xhash', success: true }),
    getEarnBalances: vi.fn().mockResolvedValue(null),
    withdraw: vi.fn().mockResolvedValue({ hash: '0xhash', success: true }),
  } as unknown as SmartWallet;
};
