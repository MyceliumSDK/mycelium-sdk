import type { Address } from 'viem';
import { base } from 'viem/chains';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { ChainManager } from '@mycelium-sdk/core/tools/ChainManager';
import type { TokenInfo } from '@mycelium-sdk/core/utils/tokens';
import { createMockChainManager } from '@mycelium-sdk/core/test/mocks/ChainManagerMock';

import { fetchERC20Balance, fetchETHBalance } from '@mycelium-sdk/core/tools/TokenBalance';

describe('TokenBalance', () => {
  let chainManager: ChainManager;
  let mockToken: TokenInfo;
  const walletAddress: Address = '0x1234567890123456789012345678901234567890';

  beforeEach(() => {
    chainManager = createMockChainManager() as unknown as ChainManager;

    mockToken = {
      symbol: 'USDC',
      name: 'USD Coin',
      decimals: 6,
      addresses: {
        [base.id]: '0x078d782b760474a361dda0af3839290b0ef57ad6',
      },
    };
  });

  describe('fetchBalance', () => {
    it('should fetch token balance across supported chains', async () => {
      const mockPublicClient = vi.mocked(chainManager.getPublicClient(base.id));
      mockPublicClient.readContract.mockResolvedValue(1000000n);

      const balance = await fetchERC20Balance(chainManager, walletAddress, mockToken);

      expect(balance).toEqual({
        symbol: 'USDC',
        totalBalance: 1000000n,
        totalFormattedBalance: '1',
        chainBalances: [
          {
            chainId: base.id,
            balance: 1000000n,
            formattedBalance: '1',
          },
        ],
      });
    });

    it('should throw error when token not supported on a chain', async () => {
      const unsupportedToken: TokenInfo = {
        symbol: 'UNSUPPORTED',
        name: 'Unsupported Token',
        decimals: 18,
        addresses: {
          27637: '0xBAa5CC21fd487B8Fcc2F632f3F4E8D37262a0842',
        } as any,
      };

      const supportedChain = chainManager.getSupportedChain();
      const mockPublicClient = vi.mocked(chainManager.getPublicClient(supportedChain));
      mockPublicClient.readContract.mockResolvedValue(0n);

      await expect(
        fetchERC20Balance(chainManager, walletAddress, unsupportedToken),
      ).rejects.toThrow(`${unsupportedToken.symbol} not supported on chain ${supportedChain}`);
    });
  });

  describe('fetchETHBalance', () => {
    it('should fetch ETH balance across supported chains', async () => {
      const supportedChain = chainManager.getSupportedChain();
      const mockPublicClient = vi.mocked(chainManager.getPublicClient(supportedChain));

      mockPublicClient.getBalance.mockResolvedValue(1000000n);
      const balance = await fetchETHBalance(chainManager, walletAddress);

      expect(balance).toEqual({
        symbol: 'ETH',
        totalBalance: 1000000n,
        totalFormattedBalance: '0.000000000001',
        chainBalances: [
          {
            chainId: base.id,
            balance: 1000000n,
            formattedBalance: '0.000000000001',
          },
        ],
      });
    });
  });
});
