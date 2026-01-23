import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ProxyProtocol } from '@mycelium-sdk/core/protocols/implementations/ProxyProtocol';
import { createMockChainManager } from '@mycelium-sdk/core/test/mocks/ChainManagerMock';
import { createMockSmartWallet } from '@mycelium-sdk/core/test/mocks/SmartWalletMock';
import type { ChainManager } from '@mycelium-sdk/core/tools/ChainManager';
import type { ApiClient } from '@mycelium-sdk/core/tools/ApiClient';
import type { SmartWallet } from '@mycelium-sdk/core/wallet/base/wallets/SmartWallet';
import type {
  ProtocolsSecurityConfig,
  VaultInfo,
  VaultBalance,
} from '@mycelium-sdk/core/types/protocols/general';
import type { ProxyVaults, ProxyBalance } from '@mycelium-sdk/core/types/protocols/proxy';
import type { TransactionData } from '@mycelium-sdk/core/types/transaction';
import { encodeFunctionData, erc20Abi, parseUnits, type Address, type Hash } from 'viem';

// Mock viem functions
vi.mock('viem', async () => {
  const actual = await vi.importActual<any>('viem');
  return {
    ...actual,
    encodeFunctionData: vi.fn(),
    parseUnits: vi.fn(),
  };
});

describe('ProxyProtocol integration tests', () => {
  let proxyProtocol: ProxyProtocol;
  let chainManager: ChainManager;
  let apiClient: ApiClient;
  let smartWallet: SmartWallet;
  let protocolsSecurityConfig: ProtocolsSecurityConfig;

  const mockVaultInfo: VaultInfo = {
    id: 'vault-1',
    protocolId: 'spark',
    vaultAddress: '0x1111111111111111111111111111111111111111' as Address,
    tokenAddress: '0x2222222222222222222222222222222222222222' as Address,
    tokenDecimals: 6,
    tokenSymbol: 'USDC',
    name: 'Spark USDC Vault',
    type: 'stable',
    chain: 'base',
  };

  const mockProxyBalance: ProxyBalance = {
    userAddress: '0x1234567890123456789012345678901234567890' as Address,
    integratorId: 'test-integrator',
    protocolId: 'spark',
    vaultAddress: mockVaultInfo.vaultAddress,
    chainId: 8453,
    currentBalance: '1000.0',
    actualCurrentBalance: '1000.0',
    pnl: 0.05,
    balanceInShares: '1000.0',
    earnedOverall: '50.0',
    earned7d: '5.0',
    earned30d: '20.0',
    earned90d: '45.0',
    earnedOverallUpdatedAt: '2024-01-01T00:00:00Z',
    earned7dUpdatedAt: '2024-01-01T00:00:00Z',
    earned30dUpdatedAt: '2024-01-01T00:00:00Z',
    earned90dUpdatedAt: '2024-01-01T00:00:00Z',
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetAllMocks();

    chainManager = createMockChainManager();
    smartWallet = createMockSmartWallet();
    protocolsSecurityConfig = { riskLevel: 'medium' };

    apiClient = {
      sendRequest: vi.fn(),
    } as unknown as ApiClient;

    proxyProtocol = new ProxyProtocol();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('init', () => {
    it('should initialize protocol with chain manager, config, and API client', async () => {
      await proxyProtocol.init(chainManager, protocolsSecurityConfig, apiClient);

      expect(chainManager.getSupportedChain).toHaveBeenCalled();
      expect(chainManager.getPublicClient).toHaveBeenCalled();
    });

    it('should set selected chain ID from chain manager', async () => {
      await proxyProtocol.init(chainManager, protocolsSecurityConfig, apiClient);

      const chainId = (chainManager.getSupportedChain as ReturnType<typeof vi.fn>).mock.results[0]
        ?.value;
      expect(chainId).toBe(8453);
    });
  });

  describe('getBestVaults', () => {
    beforeEach(async () => {
      await proxyProtocol.init(chainManager, protocolsSecurityConfig, apiClient);
    });

    it('should fetch and return best vaults from API', async () => {
      const mockVaults: ProxyVaults = {
        stableVaults: [mockVaultInfo],
        nonStableVaults: [],
      };

      (apiClient.sendRequest as ReturnType<typeof vi.fn>).mockResolvedValue({
        success: true,
        data: mockVaults,
      });

      const result = await proxyProtocol.getBestVaults(1, 1);

      expect(apiClient.sendRequest).toHaveBeenCalledWith('vaults', {
        risk_level: 'medium',
        chain_id: '8453',
        stable_vaults_limit: '1',
        non_stable_vaults_limit: '1',
      });

      expect(result.stable).toHaveLength(1);
      expect(result.stable[0]).toMatchObject({
        id: mockVaultInfo.id,
        protocolId: mockVaultInfo.protocolId,
        vaultAddress: mockVaultInfo.vaultAddress,
      });
    });

    it('should handle API errors when fetching vaults', async () => {
      (apiClient.sendRequest as ReturnType<typeof vi.fn>).mockResolvedValue({
        success: false,
        error: 'API error occurred',
      });

      await expect(proxyProtocol.getBestVaults()).rejects.toThrow('API error occurred');
    });

    it('should use custom limits for stable and non-stable vaults', async () => {
      const mockVaults: ProxyVaults = {
        stableVaults: [mockVaultInfo],
        nonStableVaults: [],
      };

      (apiClient.sendRequest as ReturnType<typeof vi.fn>).mockResolvedValue({
        success: true,
        data: mockVaults,
      });

      await proxyProtocol.getBestVaults(3, 2);

      expect(apiClient.sendRequest).toHaveBeenCalledWith('vaults', {
        risk_level: 'medium',
        chain_id: '8453',
        stable_vaults_limit: '3',
        non_stable_vaults_limit: '2',
      });
    });
  });

  describe('deposit', () => {
    beforeEach(async () => {
      await proxyProtocol.init(chainManager, protocolsSecurityConfig, apiClient);
      vi.mocked(parseUnits).mockReturnValue(BigInt('1000000000')); // 1000 USDC with 6 decimals
    });

    it('should deposit funds without approval when allowance is sufficient', async () => {
      const mockPublicClient = chainManager.getPublicClient(8453);
      vi.mocked(mockPublicClient.readContract as ReturnType<typeof vi.fn>).mockResolvedValue(
        BigInt('2000000000'), // Allowance is greater than deposit amount
      );

      const mockOperationData: TransactionData = {
        to: mockVaultInfo.vaultAddress,
        data: '0x1234' as `0x${string}`,
      };

      (apiClient.sendRequest as ReturnType<typeof vi.fn>).mockResolvedValue({
        success: true,
        data: mockOperationData,
      });

      (smartWallet.sendBatch as ReturnType<typeof vi.fn>).mockResolvedValue('0xhash123' as Hash);

      (apiClient.sendRequest as ReturnType<typeof vi.fn>)
        .mockResolvedValueOnce({
          success: true,
          data: mockOperationData,
        })
        .mockResolvedValueOnce({
          success: true,
        });

      const result = await proxyProtocol.deposit(mockVaultInfo, '1000', smartWallet);

      expect(result.success).toBe(true);
      expect(result.hash).toBe('0xhash123');
      expect(smartWallet.sendBatch).toHaveBeenCalledWith([mockOperationData], 8453, undefined);
      expect(apiClient.sendRequest).toHaveBeenCalledWith('deposit', undefined, 'spark', {
        vaultInfo: mockVaultInfo,
        amount: '1000',
        chainId: '8453',
      });
    });

    it('should include approval transaction when allowance is insufficient', async () => {
      const mockPublicClient = chainManager.getPublicClient(8453);
      vi.mocked(mockPublicClient.readContract as ReturnType<typeof vi.fn>).mockResolvedValue(
        BigInt('500000000'), // Allowance is less than deposit amount
      );

      const mockApproveData = '0xhash123' as `0x${string}`;
      vi.mocked(encodeFunctionData).mockReturnValue(mockApproveData);

      const mockOperationData: TransactionData = {
        to: mockVaultInfo.vaultAddress,
        data: '0x1234' as `0x${string}`,
      };

      (apiClient.sendRequest as ReturnType<typeof vi.fn>)
        .mockResolvedValueOnce({
          success: true,
          data: mockOperationData,
        })
        .mockResolvedValueOnce({
          success: true,
        });

      (smartWallet.sendBatch as ReturnType<typeof vi.fn>).mockResolvedValue('0x123123' as Hash);

      const result = await proxyProtocol.deposit(mockVaultInfo, '1000', smartWallet);

      expect(encodeFunctionData).toHaveBeenCalledWith({
        abi: erc20Abi,
        functionName: 'approve',
        args: [mockVaultInfo.vaultAddress, BigInt('1000000000')],
      });

      expect(smartWallet.sendBatch).toHaveBeenCalledWith(
        [
          {
            to: mockVaultInfo.tokenAddress,
            data: mockApproveData,
          },
          mockOperationData,
        ],
        8453,
        undefined,
      );

      expect(result.success).toBe(true);
    });

    it('should throw error when vault protocol ID is missing', async () => {
      const vaultWithoutProtocolId = { ...mockVaultInfo, protocolId: undefined as any };

      await expect(
        proxyProtocol.deposit(vaultWithoutProtocolId, '1000', smartWallet),
      ).rejects.toThrow('Vault protocol ID is required');
    });

    it('should throw error when API fails to return deposit operations', async () => {
      const mockPublicClient = chainManager.getPublicClient(8453);
      vi.mocked(mockPublicClient.readContract as ReturnType<typeof vi.fn>).mockResolvedValue(
        BigInt('2000000000'),
      );

      (apiClient.sendRequest as ReturnType<typeof vi.fn>).mockResolvedValue({
        success: false,
        error: 'API error',
      });

      await expect(proxyProtocol.deposit(mockVaultInfo, '1000', smartWallet)).rejects.toThrow(
        'API error',
      );
    });

    it('should log operation after successful deposit', async () => {
      const mockPublicClient = chainManager.getPublicClient(8453);
      vi.mocked(mockPublicClient.readContract as ReturnType<typeof vi.fn>).mockResolvedValue(
        BigInt('2000000000'),
      );

      const mockOperationData: TransactionData = {
        to: mockVaultInfo.vaultAddress,
        data: '0x1234' as `0x${string}`,
      };

      (apiClient.sendRequest as ReturnType<typeof vi.fn>)
        .mockResolvedValueOnce({
          success: true,
          data: mockOperationData,
        })
        .mockResolvedValueOnce({
          success: true,
        });

      (smartWallet.sendBatch as ReturnType<typeof vi.fn>).mockResolvedValue('0xhash123' as Hash);

      await proxyProtocol.deposit(mockVaultInfo, '1000', smartWallet);

      expect(apiClient.sendRequest).toHaveBeenCalledWith(
        'log',
        undefined,
        undefined,
        expect.objectContaining({
          operationType: 'deposit',
          status: 'completed',
          transactionHash: '0xhash123',
        }),
      );
    });

    it('should deposit with paymaster token when paymaster token equals deposit token', async () => {
      const paymasterToken = mockVaultInfo.tokenAddress;
      const mockPublicClient = chainManager.getPublicClient(8453);

      // Mock balance check (for gas reserve) and allowance check
      vi.mocked(mockPublicClient.readContract as ReturnType<typeof vi.fn>)
        .mockResolvedValueOnce(BigInt('2000000000'))
        .mockResolvedValueOnce(BigInt('2000000000'));

      const mockOperationData: TransactionData = {
        to: mockVaultInfo.vaultAddress,
        data: '0x1234' as `0x${string}`,
      };

      (apiClient.sendRequest as ReturnType<typeof vi.fn>)
        .mockResolvedValueOnce({
          success: true,
          data: mockOperationData,
        })
        .mockResolvedValueOnce({
          success: true,
        });

      (smartWallet.sendBatch as ReturnType<typeof vi.fn>).mockResolvedValue('0xhash123' as Hash);

      const result = await proxyProtocol.deposit(mockVaultInfo, '1000', smartWallet, {
        paymasterToken,
      });

      expect(mockPublicClient.readContract).toHaveBeenCalledWith({
        address: mockVaultInfo.tokenAddress,
        abi: erc20Abi,
        functionName: 'balanceOf',
        args: [expect.any(String)],
      });

      expect(smartWallet.sendBatch).toHaveBeenCalledWith([mockOperationData], 8453, {
        paymasterToken,
      });
      expect(result.success).toBe(true);
      expect(result.hash).toBe('0xhash123');
    });

    it('should throw error when deposit amount exceeds balance minus gas reserve', async () => {
      const paymasterToken = mockVaultInfo.tokenAddress;
      const mockPublicClient = chainManager.getPublicClient(8453);

      // Mock balance that's too low for gas reserve
      vi.mocked(mockPublicClient.readContract as ReturnType<typeof vi.fn>).mockResolvedValue(
        BigInt('500000000'),
      );

      await expect(
        proxyProtocol.deposit(mockVaultInfo, '1000', smartWallet, { paymasterToken }),
      ).rejects.toThrow('Insufficient balance. Must reserve tokens for gas payment.');
    });
  });

  describe('withdraw', () => {
    beforeEach(async () => {
      await proxyProtocol.init(chainManager, protocolsSecurityConfig, apiClient);
    });

    it('should withdraw specified amount from vault', async () => {
      const mockEarningBalances: VaultBalance[] = [
        {
          vaultInfo: mockVaultInfo,
          balance: mockProxyBalance,
        },
      ];

      vi.mocked(smartWallet.getEarnBalances).mockResolvedValue(mockEarningBalances);

      const mockOperationData: TransactionData = {
        to: mockVaultInfo.vaultAddress,
        data: '0xhash123' as `0x${string}`,
      };

      (apiClient.sendRequest as ReturnType<typeof vi.fn>)
        .mockResolvedValueOnce({
          success: true,
          data: mockOperationData,
        })
        .mockResolvedValueOnce({
          success: true,
        });

      (smartWallet.send as ReturnType<typeof vi.fn>).mockResolvedValue('0xhash456' as Hash);

      const result = await proxyProtocol.withdraw(mockVaultInfo, '500', smartWallet);

      expect(apiClient.sendRequest).toHaveBeenCalledWith('withdraw', undefined, 'spark', {
        vaultInfo: mockVaultInfo,
        amount: '500',
        chainId: 8453,
      });

      expect(smartWallet.send).toHaveBeenCalledWith(mockOperationData, 8453, undefined);
      expect(result.success).toBe(true);
      expect(result.hash).toBe('0xhash456');
    });

    it('should withdraw all balance when amount is not specified', async () => {
      const mockEarningBalances: VaultBalance[] = [
        {
          vaultInfo: mockVaultInfo,
          balance: mockProxyBalance,
        },
      ];

      vi.mocked(smartWallet.getEarnBalances).mockResolvedValue(mockEarningBalances);

      const mockOperationData: TransactionData = {
        to: mockVaultInfo.vaultAddress,
        data: '0xhash123' as `0x${string}`,
      };

      (apiClient.sendRequest as ReturnType<typeof vi.fn>)
        .mockResolvedValueOnce({
          success: true,
          data: mockOperationData,
        })
        .mockResolvedValueOnce({
          success: true,
        });

      (smartWallet.send as ReturnType<typeof vi.fn>).mockResolvedValue('0xhash456' as Hash);

      const result = await proxyProtocol.withdraw(mockVaultInfo, '', smartWallet);

      expect(apiClient.sendRequest).toHaveBeenCalledWith('withdraw', undefined, 'spark', {
        vaultInfo: mockVaultInfo,
        amount: mockProxyBalance.currentBalance,
        chainId: 8453,
      });

      expect(result.success).toBe(true);
    });

    it('should throw error when no earning balances found', async () => {
      vi.mocked(smartWallet.getEarnBalances).mockResolvedValue(null);

      await expect(proxyProtocol.withdraw(mockVaultInfo, '500', smartWallet)).rejects.toThrow(
        'No earning balances found',
      );
    });

    it('should throw error when vault balance not found in earning balances', async () => {
      const mockEarningBalances: VaultBalance[] = [
        {
          vaultInfo: { ...mockVaultInfo, id: 'different-vault' },
          balance: mockProxyBalance,
        },
      ];

      vi.mocked(smartWallet.getEarnBalances).mockResolvedValue(mockEarningBalances);

      await expect(proxyProtocol.withdraw(mockVaultInfo, '500', smartWallet)).rejects.toThrow(
        'No earning balance found',
      );
    });

    it('should throw error when API fails to return withdraw operations', async () => {
      const mockEarningBalances: VaultBalance[] = [
        {
          vaultInfo: mockVaultInfo,
          balance: mockProxyBalance,
        },
      ];

      vi.mocked(smartWallet.getEarnBalances).mockResolvedValue(mockEarningBalances);

      (apiClient.sendRequest as ReturnType<typeof vi.fn>).mockResolvedValue({
        success: false,
        error: 'API error',
      });

      await expect(proxyProtocol.withdraw(mockVaultInfo, '500', smartWallet)).rejects.toThrow(
        'API error',
      );
    });

    it('should log operation after successful withdrawal', async () => {
      const mockEarningBalances: VaultBalance[] = [
        {
          vaultInfo: mockVaultInfo,
          balance: mockProxyBalance,
        },
      ];

      vi.mocked(smartWallet.getEarnBalances).mockResolvedValue(mockEarningBalances);

      const mockOperationData: TransactionData = {
        to: mockVaultInfo.vaultAddress,
        data: '0xhash123' as `0x${string}`,
      };

      (apiClient.sendRequest as ReturnType<typeof vi.fn>)
        .mockResolvedValueOnce({
          success: true,
          data: mockOperationData,
        })
        .mockResolvedValueOnce({
          success: true,
        });

      (smartWallet.send as ReturnType<typeof vi.fn>).mockResolvedValue('0xhash456' as Hash);

      await proxyProtocol.withdraw(mockVaultInfo, '500', smartWallet);

      expect(apiClient.sendRequest).toHaveBeenCalledWith(
        'log',
        undefined,
        undefined,
        expect.objectContaining({
          operationType: 'withdrawal',
          status: 'completed',
          transactionHash: '0xhash456',
        }),
      );
    });

    it('should withdraw with paymaster token when paymaster token equals withdraw token', async () => {
      const paymasterToken = mockVaultInfo.tokenAddress;
      const mockPublicClient = chainManager.getPublicClient(8453);
      const mockEarningBalances: VaultBalance[] = [
        {
          vaultInfo: mockVaultInfo,
          balance: mockProxyBalance,
        },
      ];

      vi.mocked(smartWallet.getEarnBalances).mockResolvedValue(mockEarningBalances);

      // Mock balance check for gas reserve
      vi.mocked(mockPublicClient.readContract as ReturnType<typeof vi.fn>).mockResolvedValue(
        BigInt('2000000000'),
      );

      const mockOperationData: TransactionData = {
        to: mockVaultInfo.vaultAddress,
        data: '0xhash123' as `0x${string}`,
      };

      (apiClient.sendRequest as ReturnType<typeof vi.fn>)
        .mockResolvedValueOnce({
          success: true,
          data: mockOperationData,
        })
        .mockResolvedValueOnce({
          success: true,
        });

      (smartWallet.send as ReturnType<typeof vi.fn>).mockResolvedValue('0xhash456' as Hash);

      const result = await proxyProtocol.withdraw(mockVaultInfo, '500', smartWallet, {
        paymasterToken,
      });

      // Verify balance check was performed
      expect(mockPublicClient.readContract).toHaveBeenCalledWith({
        address: mockVaultInfo.tokenAddress,
        abi: erc20Abi,
        functionName: 'balanceOf',
        args: [expect.any(String)],
      });

      expect(smartWallet.send).toHaveBeenCalledWith(mockOperationData, 8453, { paymasterToken });
      expect(result.success).toBe(true);
      expect(result.hash).toBe('0xhash456');
    });

    it('should throw error when wallet balance is insufficient for gas payment', async () => {
      const paymasterToken = mockVaultInfo.tokenAddress;
      const mockPublicClient = chainManager.getPublicClient(8453);
      const mockEarningBalances: VaultBalance[] = [
        {
          vaultInfo: mockVaultInfo,
          balance: mockProxyBalance,
        },
      ];

      vi.mocked(smartWallet.getEarnBalances).mockResolvedValue(mockEarningBalances);

      // Mock balance that's too low for gas reserve
      vi.mocked(mockPublicClient.readContract as ReturnType<typeof vi.fn>).mockResolvedValue(
        BigInt('0'),
      );

      await expect(
        proxyProtocol.withdraw(mockVaultInfo, '500', smartWallet, { paymasterToken }),
      ).rejects.toThrow('Insufficient wallet balance for gas payment');
    });
  });

  describe('getBalances', () => {
    beforeEach(async () => {
      await proxyProtocol.init(chainManager, protocolsSecurityConfig, apiClient);
    });

    it('should fetch and return earning balances of a user by a provided address', async () => {
      const walletAddress = '0x1234567890123456789012345678901234567890' as Address;
      const mockBalances: VaultBalance[] = [
        {
          vaultInfo: mockVaultInfo,
          balance: mockProxyBalance,
        },
      ];

      (apiClient.sendRequest as ReturnType<typeof vi.fn>).mockResolvedValue({
        success: true,
        data: mockBalances,
      });

      const result = await proxyProtocol.getBalances(walletAddress);

      expect(apiClient.sendRequest).toHaveBeenCalledWith('balances', {
        chain_id: '8453',
        protocol_id: '',
        userAddress: walletAddress,
      });

      expect(result).toEqual(mockBalances);
    });

    it('should fetch balances for specific protocol ID', async () => {
      const walletAddress = '0x1234567890123456789012345678901234567890' as Address;
      const mockBalances: VaultBalance[] = [
        {
          vaultInfo: mockVaultInfo,
          balance: mockProxyBalance,
        },
      ];

      (apiClient.sendRequest as ReturnType<typeof vi.fn>).mockResolvedValue({
        success: true,
        data: mockBalances,
      });

      await proxyProtocol.getBalances(walletAddress, 'spark');

      expect(apiClient.sendRequest).toHaveBeenCalledWith('balances', {
        chain_id: '8453',
        protocol_id: 'spark',
        userAddress: walletAddress,
      });
    });

    it('should throw error when API fails to return balances', async () => {
      const walletAddress = '0x1234567890123456789012345678901234567890' as Address;

      (apiClient.sendRequest as ReturnType<typeof vi.fn>).mockResolvedValue({
        success: false,
        error: 'API error',
      });

      await expect(proxyProtocol.getBalances(walletAddress)).rejects.toThrow('API error');
    });
  });
});
