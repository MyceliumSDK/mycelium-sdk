import { type Address, type LocalAccount, pad } from 'viem';
import { toCoinbaseSmartAccount } from 'viem/account-abstraction';
import { baseSepolia, unichain } from 'viem/chains';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { smartWalletFactoryAbi } from '@mycelium/sdk/abis/smartWalletFactory';
import { smartWalletFactoryAddress } from '@mycelium/sdk/constants/addresses';
import type { ChainManager } from '@mycelium/sdk/tools/ChainManager';
import { createMockChainManager } from '@mycelium/sdk/test/mocks/ChainManagerMock';
import { getRandomAddress } from '@mycelium/sdk/test/utils';
import { DefaultSmartWallet } from '@mycelium/sdk/wallet/DefaultSmartWallet';
import { createMockProtocol } from '@mycelium/sdk/test/mocks/ProtocolMock';
import type { TransactionData } from '@mycelium/sdk/types/transaction';
import { createMockCoinbaseCDP } from '@mycelium/sdk/test/mocks/CoinbaseCDPMock';
import type { CoinbaseCDP } from '@mycelium/sdk/tools/CoinbaseCDP';
import { onRampResponseMock } from '@mycelium/sdk/test/mocks/ramp/on-ramp';
import { offRampResponseMock } from '@mycelium/sdk/test/mocks/ramp/off-ramp';
import type { VaultInfo, VaultBalance } from '@mycelium/sdk/types/protocols/general';
import { SPARK_VAULT } from '@mycelium/sdk/protocols/constants/spark';

vi.mock('viem/account-abstraction', () => ({
  toCoinbaseSmartAccount: vi.fn(),
}));

describe('DefaultSmartWallet integration tests', () => {
  let mockOwners: Address[];
  let mockSigner: LocalAccount;
  let mockChainManager: ChainManager;
  let mockProtocol: ReturnType<typeof createMockProtocol>;
  let mockCoinbaseCDP: CoinbaseCDP;
  let mockVaultInfo: VaultInfo;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetAllMocks();

    mockOwners = [getRandomAddress(), getRandomAddress()];
    mockSigner = {
      address: mockOwners[0],
      type: 'local',
    } as unknown as LocalAccount;
    mockChainManager = createMockChainManager() as unknown as ChainManager;
    mockProtocol = createMockProtocol();
    mockCoinbaseCDP = createMockCoinbaseCDP();
    mockVaultInfo = SPARK_VAULT[0]!;
  });

  describe('constructor and basic properties', () => {
    it('should create a smart wallet instance', () => {
      const wallet = new DefaultSmartWallet(
        mockOwners,
        mockSigner,
        mockChainManager,
        mockProtocol,
        mockCoinbaseCDP,
      );
      expect(wallet).toBeInstanceOf(DefaultSmartWallet);
    });

    it('should return the correct signer', () => {
      const wallet = new DefaultSmartWallet(
        mockOwners,
        mockSigner,
        mockChainManager,
        mockProtocol,
        mockCoinbaseCDP,
      );
      expect(wallet.signer).toEqual(mockSigner);
    });
  });

  describe('getAddress', () => {
    it('should get the wallet address from factory', async () => {
      const wallet = new DefaultSmartWallet(
        mockOwners,
        mockSigner,
        mockChainManager,
        mockProtocol,
        mockCoinbaseCDP,
      );
      const mockAddress = getRandomAddress();
      const publicClient = vi.mocked(mockChainManager.getPublicClient(baseSepolia.id));
      publicClient.readContract = vi.fn().mockResolvedValue(mockAddress);

      const address = await wallet.getAddress();

      expect(address).toBe(mockAddress);
      expect(publicClient.readContract).toHaveBeenCalledWith({
        abi: smartWalletFactoryAbi,
        address: smartWalletFactoryAddress,
        functionName: 'getAddress',
        args: [mockOwners.map((owner) => pad(owner)), BigInt(0)],
      });
    });

    it('should return the deployment address when provided', async () => {
      const deploymentAddress = getRandomAddress();
      const wallet = new DefaultSmartWallet(
        mockOwners,
        mockSigner,
        mockChainManager,
        mockProtocol,
        mockCoinbaseCDP,
        deploymentAddress,
      );
      const address = await wallet.getAddress();
      expect(address).toBe(deploymentAddress);
    });
  });

  describe('getCoinbaseSmartAccount', () => {
    it('should call toCoinbaseSmartAccount with correct arguments', async () => {
      const deploymentAddress = getRandomAddress();
      const signerOwnerIndex = 1;
      const nonce = BigInt(123);
      const wallet = new DefaultSmartWallet(
        mockOwners,
        mockSigner,
        mockChainManager,
        mockProtocol,
        mockCoinbaseCDP,
        deploymentAddress,
        signerOwnerIndex,
        nonce,
      );
      const chainId = unichain.id;
      await wallet.getCoinbaseSmartAccount(chainId);

      const toCoinbaseSmartAccountMock = vi.mocked(toCoinbaseSmartAccount);
      expect(toCoinbaseSmartAccountMock).toHaveBeenCalledWith({
        address: deploymentAddress,
        ownerIndex: signerOwnerIndex,
        client: mockChainManager.getPublicClient(chainId),
        owners: [wallet.signer],
        nonce: nonce,
        version: '1.1',
      });
    });
  });

  describe('send', () => {
    it('should send a transaction via ERC-4337', async () => {
      const wallet = new DefaultSmartWallet(
        mockOwners,
        mockSigner,
        mockChainManager,
        mockProtocol,
        mockCoinbaseCDP,
      );
      const chainId = unichain.id;
      const recipientAddress = getRandomAddress();
      const value = BigInt(1000);
      const data = '0x123';
      const transactionData: TransactionData = {
        to: recipientAddress,
        value,
        data,
      };
      const mockAccount = {
        address: '0x123',
        client: mockChainManager.getPublicClient(baseSepolia.id),
        owners: [mockSigner],
        nonce: BigInt(0),
      } as any;
      vi.mocked(toCoinbaseSmartAccount).mockResolvedValue(mockAccount);
      const bundlerClient = mockChainManager.getBundlerClient(chainId, mockAccount);

      const mockGasEstimate = {
        callGasLimit: BigInt(100000),
        verificationGasLimit: BigInt(100000),
        preVerificationGas: BigInt(100000),
      };
      vi.mocked(bundlerClient.estimateUserOperationGas).mockResolvedValue(mockGasEstimate);
      vi.mocked(bundlerClient.sendUserOperation).mockResolvedValue('0xTransactionHash');
      // vi.mocked(bundlerClient.waitForUserOperationReceipt).mockResolvedValue({
      //   receipt: {} as unknown as TransactionReceipt,
      // });

      const result = await wallet.send(transactionData, chainId);

      expect(mockChainManager.getBundlerClient).toHaveBeenCalledWith(chainId, mockAccount);
      expect(bundlerClient.estimateUserOperationGas).toHaveBeenCalledWith({
        account: mockAccount,
        calls: [transactionData],
      });
      expect(bundlerClient.sendUserOperation).toHaveBeenCalledWith({
        account: mockAccount,
        calls: [transactionData],
        callGasLimit: expect.any(BigInt),
        verificationGasLimit: expect.any(BigInt),
        preVerificationGas: expect.any(BigInt),
      });
      expect(bundlerClient.waitForUserOperationReceipt).toHaveBeenCalledWith({
        hash: '0xTransactionHash',
      });
      expect(result).toBe('0xTransactionHash');
    });

    it('should handle transaction errors', async () => {
      const wallet = new DefaultSmartWallet(
        mockOwners,
        mockSigner,
        mockChainManager,
        mockProtocol,
        mockCoinbaseCDP,
      );
      const chainId = unichain.id;
      const transactionData: TransactionData = {
        to: getRandomAddress(),
        value: BigInt(1000),
        data: '0x123',
      };
      const mockAccount = {
        address: '0x123',
        client: mockChainManager.getPublicClient(baseSepolia.id),
        owners: [mockSigner],
        nonce: BigInt(0),
      } as any;
      vi.mocked(toCoinbaseSmartAccount).mockResolvedValue(mockAccount);
      const bundlerClient = mockChainManager.getBundlerClient(chainId, mockAccount);

      const error = new Error('Transaction failed');
      vi.mocked(bundlerClient.estimateUserOperationGas).mockRejectedValue(error);

      await expect(wallet.send(transactionData, chainId)).rejects.toThrow(
        'Failed to send transaction',
      );
    });
  });

  describe('sendBatch', () => {
    it('should send a batch transaction via ERC-4337', async () => {
      const wallet = new DefaultSmartWallet(
        mockOwners,
        mockSigner,
        mockChainManager,
        mockProtocol,
        mockCoinbaseCDP,
      );
      const chainId = unichain.id;
      const recipientAddress = getRandomAddress();
      const value = BigInt(1000);
      const data = '0x123';
      const transactionData: TransactionData[] = [
        {
          to: recipientAddress,
          value,
          data,
        },
      ];
      const mockAccount = {
        address: '0x123',
        client: mockChainManager.getPublicClient(baseSepolia.id),
        owners: [mockSigner],
        nonce: BigInt(0),
      } as any;
      vi.mocked(toCoinbaseSmartAccount).mockResolvedValue(mockAccount);
      const bundlerClient = mockChainManager.getBundlerClient(chainId, mockAccount);

      const mockGasEstimate = {
        callGasLimit: BigInt(100000),
        verificationGasLimit: BigInt(100000),
        preVerificationGas: BigInt(100000),
      };
      vi.mocked(bundlerClient.estimateUserOperationGas).mockResolvedValue(mockGasEstimate);
      vi.mocked(bundlerClient.sendUserOperation).mockResolvedValue('0xTransactionHash');
      // vi.mocked(bundlerClient.waitForUserOperationReceipt).mockResolvedValue({
      //   receipt: {} as any,
      // });

      const result = await wallet.sendBatch(transactionData, chainId);

      expect(mockChainManager.getBundlerClient).toHaveBeenCalledWith(chainId, mockAccount);
      expect(bundlerClient.estimateUserOperationGas).toHaveBeenCalledWith({
        account: mockAccount,
        calls: transactionData,
      });
      expect(bundlerClient.sendUserOperation).toHaveBeenCalledWith({
        account: mockAccount,
        calls: transactionData,
        callGasLimit: expect.any(BigInt),
        verificationGasLimit: expect.any(BigInt),
        preVerificationGas: expect.any(BigInt),
      });
      expect(bundlerClient.waitForUserOperationReceipt).toHaveBeenCalledWith({
        hash: '0xTransactionHash',
      });
      expect(result).toBe('0xTransactionHash');
    });

    it('should handle batch transaction errors', async () => {
      const wallet = new DefaultSmartWallet(
        mockOwners,
        mockSigner,
        mockChainManager,
        mockProtocol,
        mockCoinbaseCDP,
      );
      const chainId = unichain.id;
      const transactionData: TransactionData[] = [
        {
          to: getRandomAddress(),
          value: BigInt(1000),
          data: '0x123',
        },
      ];
      const mockAccount = {
        address: '0x123',
        client: mockChainManager.getPublicClient(baseSepolia.id),
        owners: [mockSigner],
        nonce: BigInt(0),
      } as any;
      vi.mocked(toCoinbaseSmartAccount).mockResolvedValue(mockAccount);
      const bundlerClient = mockChainManager.getBundlerClient(chainId, mockAccount);

      const error = new Error('Batch transaction failed');
      vi.mocked(bundlerClient.estimateUserOperationGas).mockRejectedValue(error);

      await expect(wallet.sendBatch(transactionData, chainId)).rejects.toThrow(
        'Failed to send transaction',
      );
    });
  });

  describe('earn', () => {
    it('should deposit to a vault using protocol provider', async () => {
      const wallet = new DefaultSmartWallet(
        mockOwners,
        mockSigner,
        mockChainManager,
        mockProtocol,
        mockCoinbaseCDP,
      );

      const depositSpy = vi.mocked(mockProtocol.deposit as ReturnType<typeof vi.fn>);
      const amount = '1000';

      const result = await wallet.earn(mockVaultInfo, amount);

      expect(depositSpy).toHaveBeenCalledWith(mockVaultInfo, amount, wallet);
      expect(result.hash).toBe(
        '0x3c36293ab6884794bda1271b570ca9e9b68a406e93486359e7213a30f88c349b',
      );
      expect(result.success).toBe(true);
    });
  });

  describe('withdraw', () => {
    it('should withdraw from a vault using protocol provider', async () => {
      const wallet = new DefaultSmartWallet(
        mockOwners,
        mockSigner,
        mockChainManager,
        mockProtocol,
        mockCoinbaseCDP,
      );

      const withdrawSpy = vi.mocked(mockProtocol.withdraw as ReturnType<typeof vi.fn>);
      const amount = '1000';

      const result = await wallet.withdraw(mockVaultInfo, amount);

      expect(withdrawSpy).toHaveBeenCalledWith(mockVaultInfo, amount, wallet);
      expect(result.hash).toBe(
        '0x3c36293ab6884794bda1271b570ca9e9b68a406e93486359e7213a30f88c349b',
      );
      expect(result.success).toBe(true);
    });
  });

  describe('getEarnBalances', () => {
    it('should get balances from protocol provider', async () => {
      const wallet = new DefaultSmartWallet(
        mockOwners,
        mockSigner,
        mockChainManager,
        mockProtocol,
        mockCoinbaseCDP,
      );

      const mockBalances: VaultBalance[] = [
        {
          vaultInfo: mockVaultInfo,
          balance: '1000',
        },
      ];

      vi.mocked(mockProtocol.getBalances as ReturnType<typeof vi.fn>).mockResolvedValue(
        mockBalances,
      );

      const result = await wallet.getEarnBalances();

      expect(mockProtocol.getBalances).toHaveBeenCalledWith(await wallet.getAddress());
      expect(result).toEqual(mockBalances);
      expect(result).toHaveLength(1);
      expect(result[0]?.vaultInfo).toEqual(mockVaultInfo);
      expect(result[0]?.balance).toBe('1000');
    });

    it('should return empty array when no balances found', async () => {
      const wallet = new DefaultSmartWallet(
        mockOwners,
        mockSigner,
        mockChainManager,
        mockProtocol,
        mockCoinbaseCDP,
      );

      vi.mocked(mockProtocol.getBalances as ReturnType<typeof vi.fn>).mockResolvedValue([]);

      const result = await wallet.getEarnBalances();

      expect(result).toEqual([]);
    });
  });

  describe('topUp (on-ramp)', () => {
    let wallet: DefaultSmartWallet;

    beforeEach(() => {
      wallet = new DefaultSmartWallet(
        mockOwners,
        mockSigner,
        mockChainManager,
        mockProtocol,
        mockCoinbaseCDP,
      );
    });

    it('should generate a proper on-ramp link with all parameters', async () => {
      const amount = '100';
      const redirectUrl = 'https://mysite.com/success';
      const purchaseCurrency = 'USDC';
      const paymentCurrency = 'USD';
      const paymentMethod = 'CARD';
      const country = 'US';

      const result = await wallet.topUp(
        amount,
        redirectUrl,
        purchaseCurrency,
        paymentCurrency,
        paymentMethod,
        country,
      );

      expect(mockCoinbaseCDP.getOnRampLink).toHaveBeenCalledWith(
        await wallet.getAddress(),
        redirectUrl,
        amount,
        purchaseCurrency,
        paymentCurrency,
        paymentMethod,
        country,
      );
      expect(result).toEqual(onRampResponseMock);
    });

    it('should generate on-ramp link with minimal parameters', async () => {
      const amount = '50';
      const redirectUrl = 'https://mysite.com/success';

      const result = await wallet.topUp(amount, redirectUrl);

      expect(mockCoinbaseCDP.getOnRampLink).toHaveBeenCalledWith(
        await wallet.getAddress(),
        redirectUrl,
        amount,
        undefined,
        undefined,
        undefined,
        undefined,
      );
      expect(result).toEqual(onRampResponseMock);
    });

    it('should throw error when CoinbaseCDP is not initialized', async () => {
      const smartWalletWithoutCDP = new DefaultSmartWallet(
        [getRandomAddress()],
        mockSigner,
        mockChainManager,
        mockProtocol,
        null,
      );

      await expect(
        smartWalletWithoutCDP.topUp('100', 'https://mysite.com/success'),
      ).rejects.toThrow(
        'Coinbase CDP is not initialized. Please, provide the configuration in the SDK initialization',
      );
    });

    it('should handle CoinbaseCDP API errors', async () => {
      const error = new Error('API Error');
      mockCoinbaseCDP.getOnRampLink = vi.fn().mockRejectedValue(error);

      await expect(wallet.topUp('100', 'https://mysite.com/success')).rejects.toThrow('API Error');
    });
  });

  describe('cashOut (off-ramp)', () => {
    let wallet: DefaultSmartWallet;

    beforeEach(() => {
      wallet = new DefaultSmartWallet(
        mockOwners,
        mockSigner,
        mockChainManager,
        mockProtocol,
        mockCoinbaseCDP,
      );
    });

    it('should generate a proper off-ramp link with all parameters', async () => {
      const country = 'US';
      const paymentMethod = 'FIAT_WALLET';
      const redirectUrl = 'https://mysite.com/success';
      const sellAmount = '100';
      const cashoutCurrency = 'USD';
      const sellCurrency = 'USDC';

      const result = await wallet.cashOut(
        country,
        paymentMethod,
        redirectUrl,
        sellAmount,
        cashoutCurrency,
        sellCurrency,
      );

      expect(mockCoinbaseCDP.getOffRampLink).toHaveBeenCalledWith(
        await wallet.getAddress(),
        country,
        paymentMethod,
        redirectUrl,
        sellAmount,
        cashoutCurrency,
        sellCurrency,
      );
      expect(result).toEqual(offRampResponseMock);
    });

    it('should generate off-ramp link with minimal parameters', async () => {
      const country = 'US';
      const paymentMethod = 'CARD';
      const redirectUrl = 'https://mysite.com/success';
      const sellAmount = '50';

      const result = await wallet.cashOut(country, paymentMethod, redirectUrl, sellAmount);

      expect(mockCoinbaseCDP.getOffRampLink).toHaveBeenCalledWith(
        await wallet.getAddress(),
        country,
        paymentMethod,
        redirectUrl,
        sellAmount,
        undefined,
        undefined,
      );
      expect(result).toEqual(offRampResponseMock);
    });

    it('should throw error when CoinbaseCDP is not initialized', async () => {
      const smartWalletWithoutCDP = new DefaultSmartWallet(
        [getRandomAddress()],
        mockSigner,
        mockChainManager,
        mockProtocol,
        null,
      );

      await expect(
        smartWalletWithoutCDP.cashOut('US', 'CARD', 'https://mysite.com/success', '100'),
      ).rejects.toThrow(
        'Coinbase CDP is not initialized. Please, provide the configuration in the SDK initialization',
      );
    });

    it('should handle CoinbaseCDP API errors', async () => {
      const error = new Error('API Error');
      mockCoinbaseCDP.getOffRampLink = vi.fn().mockRejectedValue(error);

      await expect(
        wallet.cashOut('US', 'CARD', 'https://mysite.com/success', '100'),
      ).rejects.toThrow('API Error');
    });
  });

  describe('sendTokens', () => {
    let wallet: DefaultSmartWallet;

    beforeEach(() => {
      wallet = new DefaultSmartWallet(
        mockOwners,
        mockSigner,
        mockChainManager,
        mockProtocol,
        mockCoinbaseCDP,
      );
    });

    it('should send ETH tokens', async () => {
      const amount = 1.5;
      const recipientAddress = getRandomAddress();

      const result = await wallet.sendTokens(amount, 'eth', recipientAddress);

      expect(result.to).toBe(recipientAddress);
      expect(result.value).toBeGreaterThan(0n);
      expect(result.data).toBe('0x');
    });

    it('should send ERC20 tokens', async () => {
      const amount = 100;
      const recipientAddress = getRandomAddress();

      const result = await wallet.sendTokens(amount, 'usdc', recipientAddress);

      expect(result.to).toBeDefined();
      expect(result.value).toBe(0n);
      expect(result.data).toBeDefined();
      expect(result.data).not.toBe('0x');
    });

    it('should throw error when recipient address is missing', async () => {
      await expect(wallet.sendTokens(100, 'usdc', '' as Address)).rejects.toThrow(
        'Recipient address is required',
      );
    });

    it('should throw error when amount is zero or negative', async () => {
      const recipientAddress = getRandomAddress();

      await expect(wallet.sendTokens(0, 'usdc', recipientAddress)).rejects.toThrow(
        'Amount must be greater than 0',
      );

      await expect(wallet.sendTokens(-10, 'usdc', recipientAddress)).rejects.toThrow(
        'Amount must be greater than 0',
      );
    });
  });

  describe('getBalance', () => {
    it('should fetch balances for ETH and supported tokens', async () => {
      const wallet = new DefaultSmartWallet(
        mockOwners,
        mockSigner,
        mockChainManager,
        mockProtocol,
        mockCoinbaseCDP,
      );

      const mockPublicClient = mockChainManager.getPublicClient(8453);
      vi.mocked(mockPublicClient.getBalance as ReturnType<typeof vi.fn>).mockResolvedValue(
        BigInt('1000000000000000000'),
      ); // 1 ETH
      vi.mocked(mockPublicClient.readContract as ReturnType<typeof vi.fn>).mockResolvedValue(
        BigInt('1000000'),
      ); // For ERC20 tokens

      const result = await wallet.getBalance();

      expect(Array.isArray(result)).toBe(true);
      expect(result.length).toBeGreaterThan(0);
    });
  });
});
