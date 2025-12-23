import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { SparkProtocol } from '@mycelium-sdk/core/protocols/implementations/SparkProtocol';
import { createMockChainManager } from '@mycelium-sdk/core/test/mocks/ChainManagerMock';
import { createMockSmartWallet } from '@mycelium-sdk/core/test/mocks/SmartWalletMock';
import type { ChainManager } from '@mycelium-sdk/core/tools/ChainManager';
import type { SmartWallet } from '@mycelium-sdk/core/wallet/base/wallets/SmartWallet';
import type { VaultInfo } from '@mycelium-sdk/core/types/protocols/general';
import {
  encodeFunctionData,
  erc20Abi,
  formatUnits,
  parseUnits,
  type Address,
  type Hash,
} from 'viem';
import {
  SPARK_VAULT,
  SPARK_SSR_ORACLE_ADDRESS,
  RAY,
  SECONDS_PER_YEAR,
} from '@mycelium-sdk/core/protocols/constants/spark';
import { SPARK_VAULT_ABI, SPARK_SSR_ORACLE_ABI } from '@mycelium-sdk/core/abis/protocols/spark';

vi.mock('viem', async () => {
  const actual = await vi.importActual<any>('viem');
  return {
    ...actual,
    encodeFunctionData: vi.fn(),
    parseUnits: vi.fn(),
    formatUnits: vi.fn(),
  };
});

describe('SparkProtocol integration tests', () => {
  let sparkProtocol: SparkProtocol;
  let chainManager: ChainManager;
  let smartWallet: SmartWallet;

  const mockVaultInfo: VaultInfo = SPARK_VAULT[0]!;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetAllMocks();

    chainManager = createMockChainManager();
    smartWallet = createMockSmartWallet();

    sparkProtocol = new SparkProtocol();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('init', () => {
    it('should initialize protocol with chain manager', async () => {
      await sparkProtocol.init(chainManager);

      expect(chainManager.getSupportedChain).toHaveBeenCalled();
      expect(chainManager.getPublicClient).toHaveBeenCalled();
    });

    it('should set selected chain ID from chain manager', async () => {
      await sparkProtocol.init(chainManager);

      const chainId = (chainManager.getSupportedChain as ReturnType<typeof vi.fn>).mock.results[0]
        ?.value;
      expect(chainId).toBe(8453);
    });

    it('should initialize all vaults from SPARK_VAULT constant', async () => {
      await sparkProtocol.init(chainManager);

      const vaults = await sparkProtocol.getBestVaults();
      expect(vaults.stable).toHaveLength(1);
      expect(vaults.stable[0]?.id).toBe('sUSDC');
    });
  });

  describe('getAPY', () => {
    beforeEach(async () => {
      await sparkProtocol.init(chainManager);
    });

    it('should calculate and return APY based on SSR', async () => {
      const mockSSR = BigInt('1050000000000000000000000000'); // 1.05 in RAY format
      const mockPublicClient = chainManager.getPublicClient(8453);

      vi.mocked(mockPublicClient.readContract as ReturnType<typeof vi.fn>).mockResolvedValue(
        mockSSR,
      );

      const apy = await sparkProtocol.getAPY();

      expect(mockPublicClient.readContract).toHaveBeenCalledWith({
        address: SPARK_SSR_ORACLE_ADDRESS,
        abi: SPARK_SSR_ORACLE_ABI,
        functionName: 'getSSR',
      });

      // Verify APY calculation: Math.exp(Math.log(ssr) * SECONDS_PER_YEAR) - 1
      const ssr = Number(mockSSR) / Number(RAY);
      const expectedApy = (Math.exp(Math.log(ssr) * SECONDS_PER_YEAR) - 1) * 100;

      expect(apy).toBeCloseTo(expectedApy, 1);
      expect(typeof apy).toBe('number');
    });

    it('should throw error when public client is not initialized', async () => {
      const uninitializedProtocol = new SparkProtocol();

      await expect(uninitializedProtocol.getAPY()).rejects.toThrow('Public client not initialized');
    });
  });

  describe('getBestVaults', () => {
    beforeEach(async () => {
      await sparkProtocol.init(chainManager);
    });

    it('should return best vaults with calculated APY', async () => {
      const mockSSR = BigInt('1050000000000000000000000000');
      const mockPublicClient = chainManager.getPublicClient(8453);

      vi.mocked(mockPublicClient.readContract as ReturnType<typeof vi.fn>).mockResolvedValue(
        mockSSR,
      );

      const result = await sparkProtocol.getBestVaults();

      expect(result.stable).toHaveLength(1);
      expect(result.nonStable).toHaveLength(0);
      expect(result.stable[0]?.id).toBe('sUSDC');
      expect(result.stable[0]?.metadata?.apy).toBeDefined();
      expect(typeof result.stable[0]?.metadata?.apy).toBe('number');
    });

    it('should throw error when no vaults are available', async () => {
      const emptyProtocol = new SparkProtocol();
      await emptyProtocol.init(chainManager);

      (emptyProtocol as any).allVaults = [];

      await expect(emptyProtocol.getBestVaults()).rejects.toThrow('No vaults found');
    });
  });

  describe('deposit', () => {
    beforeEach(async () => {
      await sparkProtocol.init(chainManager);
      vi.mocked(parseUnits).mockReturnValue(BigInt('1000000000')); // 1000 USDC with 6 decimals
    });

    it('should deposit funds without approval when allowance is sufficient', async () => {
      const mockPublicClient = chainManager.getPublicClient(8453);
      vi.mocked(mockPublicClient.readContract as ReturnType<typeof vi.fn>).mockResolvedValue(
        BigInt('2000000000'), // Allowance is greater than deposit amount
      );

      const mockDepositData = '0xhash123' as `0x${string}`;
      vi.mocked(encodeFunctionData).mockReturnValue(mockDepositData);

      (smartWallet.sendBatch as ReturnType<typeof vi.fn>).mockResolvedValue('0xhash456' as Hash);

      const result = await sparkProtocol.deposit(mockVaultInfo, '1000', smartWallet);

      expect(parseUnits).toHaveBeenCalledWith('1000', mockVaultInfo.tokenDecimals);
      expect(mockPublicClient.readContract).toHaveBeenCalledWith({
        address: mockVaultInfo.tokenAddress,
        abi: erc20Abi,
        functionName: 'allowance',
        args: [expect.any(String), mockVaultInfo.vaultAddress],
      });

      expect(encodeFunctionData).toHaveBeenCalledWith({
        abi: SPARK_VAULT_ABI,
        functionName: 'deposit',
        args: [BigInt('1000000000'), expect.any(String)],
      });

      expect(smartWallet.sendBatch).toHaveBeenCalledWith(
        [
          {
            to: mockVaultInfo.vaultAddress,
            data: mockDepositData,
          },
        ],
        8453,
      );

      expect(result.success).toBe(true);
      expect(result.hash).toBe('0xhash456');
    });

    it('should include approval transaction when allowance is insufficient', async () => {
      const mockPublicClient = chainManager.getPublicClient(8453);
      vi.mocked(mockPublicClient.readContract as ReturnType<typeof vi.fn>).mockResolvedValue(
        BigInt('500000000'), // Allowance is less than deposit amount
      );

      const mockApproveData = '0xhash123' as `0x${string}`;
      const mockDepositData = '0xhash456' as `0x${string}`;

      vi.mocked(encodeFunctionData)
        .mockReturnValueOnce(mockApproveData)
        .mockReturnValueOnce(mockDepositData);

      (smartWallet.sendBatch as ReturnType<typeof vi.fn>).mockResolvedValue('0xhash789' as Hash);

      const result = await sparkProtocol.deposit(mockVaultInfo, '1000', smartWallet);

      expect(encodeFunctionData).toHaveBeenCalledWith({
        abi: erc20Abi,
        functionName: 'approve',
        args: [mockVaultInfo.vaultAddress, BigInt('1000000000')],
      });

      expect(encodeFunctionData).toHaveBeenCalledWith({
        abi: SPARK_VAULT_ABI,
        functionName: 'deposit',
        args: [BigInt('1000000000'), expect.any(String)],
      });

      expect(smartWallet.sendBatch).toHaveBeenCalledWith(
        [
          {
            to: mockVaultInfo.tokenAddress,
            data: mockApproveData,
          },
          {
            to: mockVaultInfo.vaultAddress,
            data: mockDepositData,
          },
        ],
        8453,
      );

      expect(result.success).toBe(true);
    });
  });

  describe('withdraw', () => {
    beforeEach(async () => {
      await sparkProtocol.init(chainManager);
    });

    it('should withdraw specified amount from vault', async () => {
      vi.mocked(parseUnits).mockReturnValue(BigInt('500000000')); // 500 USDC

      const mockWithdrawData = '0xhash123' as `0x${string}`;
      vi.mocked(encodeFunctionData).mockReturnValue(mockWithdrawData);

      (smartWallet.send as ReturnType<typeof vi.fn>).mockResolvedValue('0xhash456' as Hash);

      const result = await sparkProtocol.withdraw(mockVaultInfo, '500', smartWallet);

      expect(parseUnits).toHaveBeenCalledWith('500', mockVaultInfo.tokenDecimals);
      expect(encodeFunctionData).toHaveBeenCalledWith({
        abi: SPARK_VAULT_ABI,
        functionName: 'withdraw',
        args: [BigInt('500000000'), expect.any(String), expect.any(String)],
      });

      expect(smartWallet.send).toHaveBeenCalledWith(
        {
          to: mockVaultInfo.vaultAddress,
          data: mockWithdrawData,
        },
        8453,
      );

      expect(result.success).toBe(true);
      expect(result.hash).toBe('0xhash456');
    });

    it('should withdraw all balance when amount is undefined', async () => {
      const mockPublicClient = chainManager.getPublicClient(8453);
      const mockMaxShares = BigInt('1000000000');

      vi.mocked(mockPublicClient.readContract as ReturnType<typeof vi.fn>).mockResolvedValue(
        mockMaxShares,
      );

      const mockRedeemData = '0xhash123' as `0x${string}`;
      vi.mocked(encodeFunctionData).mockReturnValue(mockRedeemData);

      (smartWallet.send as ReturnType<typeof vi.fn>).mockResolvedValue('0xhash456' as Hash);

      const result = await sparkProtocol.withdraw(mockVaultInfo, undefined, smartWallet);

      expect(mockPublicClient.readContract).toHaveBeenCalledWith({
        address: mockVaultInfo.vaultAddress,
        abi: SPARK_VAULT_ABI,
        functionName: 'balanceOf',
        args: [expect.any(String)],
      });

      expect(encodeFunctionData).toHaveBeenCalledWith({
        abi: SPARK_VAULT_ABI,
        functionName: 'redeem',
        args: [mockMaxShares, expect.any(String), expect.any(String)],
      });

      expect(smartWallet.send).toHaveBeenCalledWith(
        {
          to: mockVaultInfo.vaultAddress,
          data: mockRedeemData,
        },
        8453,
      );

      expect(result.success).toBe(true);
    });

    it('should throw error when public client is not initialized for max shares', async () => {
      const uninitializedProtocol = new SparkProtocol();

      await expect(
        uninitializedProtocol.withdraw(mockVaultInfo, undefined, smartWallet),
      ).rejects.toThrow('Public client not initialized');
    });
  });

  describe('getBalances', () => {
    beforeEach(async () => {
      await sparkProtocol.init(chainManager);
    });

    it('should return balances for wallet address with shares', async () => {
      const walletAddress = '0x1234567890123456789012345678901234567890' as Address;
      const mockPublicClient = chainManager.getPublicClient(8453);
      const mockSSR = BigInt('1050000000000000000000000000');
      const mockShares = BigInt('1000000000');
      const mockAssets = BigInt('1050000000'); // Assets converted from shares

      // Mock getSSR call (used by getAPY)
      vi.mocked(mockPublicClient.readContract as ReturnType<typeof vi.fn>)
        .mockResolvedValueOnce(mockSSR) // For getAPY -> getSSR
        .mockResolvedValueOnce(mockShares) // For balanceOf
        .mockResolvedValueOnce(mockAssets); // For convertToAssets

      vi.mocked(formatUnits).mockReturnValue('1050.0');

      const result = await sparkProtocol.getBalances(walletAddress);

      // Verify getAPY was called (indirectly through getSSR)
      expect(mockPublicClient.readContract).toHaveBeenCalledWith({
        address: SPARK_SSR_ORACLE_ADDRESS,
        abi: SPARK_SSR_ORACLE_ABI,
        functionName: 'getSSR',
      });

      expect(mockPublicClient.readContract).toHaveBeenCalledWith({
        address: mockVaultInfo.vaultAddress,
        abi: SPARK_VAULT_ABI,
        functionName: 'balanceOf',
        args: [walletAddress],
      });

      expect(mockPublicClient.readContract).toHaveBeenCalledWith({
        address: mockVaultInfo.vaultAddress,
        abi: SPARK_VAULT_ABI,
        functionName: 'convertToAssets',
        args: [mockShares],
      });

      expect(formatUnits).toHaveBeenCalledWith(mockAssets, mockVaultInfo.tokenDecimals);

      expect(result).toHaveLength(1);
      expect(result[0]?.vaultInfo.id).toBe('sUSDC');
      expect(result[0]?.balance).toBe('1050.0');
      expect(result[0]?.vaultInfo.metadata?.apy).toBeDefined();
      expect(typeof result[0]?.vaultInfo.metadata?.apy).toBe('number');
    });

    it('should return null balance when wallet has no shares', async () => {
      const walletAddress = '0x1234567890123456789012345678901234567890' as Address;
      const mockPublicClient = chainManager.getPublicClient(8453);
      const mockSSR = BigInt('1050000000000000000000000000');

      vi.mocked(mockPublicClient.readContract as ReturnType<typeof vi.fn>)
        .mockResolvedValueOnce(mockSSR)
        .mockResolvedValueOnce(0n);

      const result = await sparkProtocol.getBalances(walletAddress);

      expect(mockPublicClient.readContract).toHaveBeenCalledWith({
        address: SPARK_SSR_ORACLE_ADDRESS,
        abi: SPARK_SSR_ORACLE_ABI,
        functionName: 'getSSR',
      });

      expect(result).toHaveLength(1);
      expect(result[0]?.balance).toBeNull();
      expect(result[0]?.vaultInfo.id).toBe('sUSDC');
      expect(result[0]?.vaultInfo.metadata?.apy).toBeDefined();
      expect(typeof result[0]?.vaultInfo.metadata?.apy).toBe('number');
    });

    it('should throw error when public client is not initialized', async () => {
      const uninitializedProtocol = new SparkProtocol();
      const walletAddress = '0x1234567890123456789012345678901234567890' as Address;

      await expect(uninitializedProtocol.getBalances(walletAddress)).rejects.toThrow(
        'Public client not initialized',
      );
    });
  });
});
