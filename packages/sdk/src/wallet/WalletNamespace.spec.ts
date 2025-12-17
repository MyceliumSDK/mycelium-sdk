import { isAddress } from 'viem';
import { describe, expect, it, vi, beforeEach } from 'vitest';

import type { ChainManager } from '@mycelium/sdk/tools/ChainManager';
import { createMockChainManager } from '@mycelium/sdk/test/mocks/ChainManagerMock';
import { createMockPrivyClient } from '@mycelium/sdk/test/mocks/PrivyClientMock';
import { getRandomAddress } from '@mycelium/sdk/test/utils';
import { DefaultSmartWallet } from '@mycelium/sdk/wallet/DefaultSmartWallet';
import { PrivyWallet } from '@mycelium/sdk/wallet/PrivyWallet';
import { DefaultSmartWalletProvider } from '@mycelium/sdk/wallet/providers/DefaultSmartWalletProvider';
import { PrivyEmbeddedWalletProvider } from '@mycelium/sdk/wallet/providers/PrivyEmbeddedWalletProvider';
import { WalletNamespace } from '@mycelium/sdk/wallet/WalletNamespace';
import { WalletProvider } from '@mycelium/sdk/wallet/WalletProvider';
import { createMockProtocol } from '@mycelium/sdk/test/mocks/ProtocolMock';
import { createMockCoinbaseCDP } from '@mycelium/sdk/test/mocks/CoinbaseCDPMock';
import type { CoinbaseCDP } from '@mycelium/sdk/tools/CoinbaseCDP';

describe('WalletNamespace integration tests', () => {
  let mockChainManager: ChainManager;
  let mockProtocol: ReturnType<typeof createMockProtocol>;
  let mockCoinbaseCDP: CoinbaseCDP;
  let mockPrivyClient: ReturnType<typeof createMockPrivyClient>;
  let embeddedWalletProvider: PrivyEmbeddedWalletProvider;
  let smartWalletProvider: DefaultSmartWalletProvider;
  let walletProvider: WalletProvider;
  let walletNamespace: WalletNamespace;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetAllMocks();

    mockChainManager = createMockChainManager() as unknown as ChainManager;
    mockProtocol = createMockProtocol();
    mockCoinbaseCDP = createMockCoinbaseCDP();
    mockPrivyClient = createMockPrivyClient('test-app-id', 'test-app-secret');

    embeddedWalletProvider = new PrivyEmbeddedWalletProvider(mockPrivyClient, mockChainManager);
    smartWalletProvider = new DefaultSmartWalletProvider(
      mockChainManager,
      mockProtocol,
      mockCoinbaseCDP,
    );
    walletProvider = new WalletProvider(embeddedWalletProvider, smartWalletProvider);
    walletNamespace = new WalletNamespace(walletProvider);
  });

  describe('createEmbeddedWallet', () => {
    it('should create an embedded wallet via namespace', async () => {
      const createEmbeddedWalletSpy = vi.spyOn(walletProvider, 'createEmbeddedWallet');

      const wallet: PrivyWallet = (await walletNamespace.createEmbeddedWallet()) as PrivyWallet;

      expect(wallet).toBeInstanceOf(PrivyWallet);
      expect(wallet.walletId).toMatch(/^mock-wallet-\d+$/);
      expect(isAddress(wallet.address)).toBe(true);
      expect(createEmbeddedWalletSpy).toHaveBeenCalledOnce();
    });
  });

  describe('createSmartWallet', () => {
    it('should create a smart wallet with provided signer and owners', async () => {
      const createSmartWalletSpy = vi.spyOn(walletProvider, 'createSmartWallet');

      // Create an embedded wallet to use as signer
      const embeddedWallet = await embeddedWalletProvider.createWallet();
      const account = await embeddedWallet.account();
      const owners = [getRandomAddress(), embeddedWallet.address];
      const nonce = BigInt(123);

      const smartWallet = await walletNamespace.createSmartWallet({
        owners,
        signer: account,
        nonce,
      });

      expect(smartWallet).toBeInstanceOf(DefaultSmartWallet);
      expect(smartWallet.signer).toBe(account);
      expect(createSmartWalletSpy).toHaveBeenCalledWith({
        owners,
        signer: account,
        nonce,
      });
    });
  });

  describe('createAccount', () => {
    it('should create a wallet with embedded signer (default owners)', async () => {
      const createAccountSpy = vi.spyOn(walletProvider, 'createAccount');

      const account = await walletNamespace.createAccount();

      expect(account.smartWallet).toBeInstanceOf(DefaultSmartWallet);
      expect(account.embeddedWalletId).toBeDefined();
      expect(account.embeddedWalletId).toMatch(/^mock-wallet-\d+$/);
      expect(createAccountSpy).toHaveBeenCalledWith(undefined);
    });

    it('should create a wallet with embedded signer and additional owners', async () => {
      const createAccountSpy = vi.spyOn(walletProvider, 'createAccount');

      const additionalOwners = [getRandomAddress(), getRandomAddress()];
      const embeddedWalletIndex = 1;
      const nonce = BigInt(456);
      const params = {
        owners: additionalOwners,
        embeddedWalletIndex,
        nonce,
      };

      const result = await walletNamespace.createAccount(params);

      expect(result.smartWallet).toBeInstanceOf(DefaultSmartWallet);
      expect(result.embeddedWalletId).toBeDefined();
      expect(createAccountSpy).toHaveBeenCalledWith(params);
    });
  });

  describe('getEmbeddedWallet', () => {
    it('should get an embedded wallet by ID', async () => {
      const getEmbeddedWalletSpy = vi.spyOn(walletProvider, 'getEmbeddedWallet');

      const createdWallet = await embeddedWalletProvider.createWallet();
      const walletId = createdWallet.walletId;

      const wallet: PrivyWallet = (await walletNamespace.getEmbeddedWallet({
        walletId,
      })) as PrivyWallet;

      expect(wallet).toBeInstanceOf(PrivyWallet);
      expect(wallet.walletId).toBe(walletId);
      expect(getEmbeddedWalletSpy).toHaveBeenCalledWith({ walletId });
    });
  });

  describe('getAccount', () => {
    it('should get a smart wallet with embedded signer', async () => {
      const getAccountSpy = vi.spyOn(walletProvider, 'getAccount');

      const embeddedWallet = await embeddedWalletProvider.createWallet();
      const walletId = embeddedWallet.walletId;
      const deploymentOwners = [embeddedWallet.address];
      const signerOwnerIndex = 0;
      const params = {
        walletId,
        deploymentOwners,
        signerOwnerIndex,
      };

      const smartWallet = await walletNamespace.getAccount(params);

      expect(smartWallet).toBeInstanceOf(DefaultSmartWallet);
      expect(getAccountSpy).toHaveBeenCalledWith(params);
    });

    it('should throw error when embedded wallet is not found', async () => {
      const invalidWalletId = 'invalid-wallet-id';

      await expect(
        walletNamespace.getAccount({
          walletId: invalidWalletId,
        }),
      ).rejects.toThrow('Failed to get wallet with id: invalid-wallet-id');
    });
  });

  describe('getSmartWallet', () => {
    it('should get a smart wallet with provided signer', async () => {
      const getSmartWalletSpy = vi.spyOn(walletProvider, 'getSmartWallet');

      const embeddedWallet = await embeddedWalletProvider.createWallet();
      const account = await embeddedWallet.account();
      const deploymentOwners = [embeddedWallet.address, getRandomAddress()];
      const signerOwnerIndex = 0;
      const nonce = BigInt(789);
      const params = {
        signer: account,
        deploymentOwners,
        signerOwnerIndex,
        nonce,
      };

      const smartWallet = await walletNamespace.getSmartWallet(params);

      expect(smartWallet).toBeInstanceOf(DefaultSmartWallet);
      expect(getSmartWalletSpy).toHaveBeenCalledWith(params);
    });

    it('should throw error when getting smart wallet without required parameters', async () => {
      const embeddedWallet = await embeddedWalletProvider.createWallet();
      const account = await embeddedWallet.account();

      await expect(
        walletNamespace.getSmartWallet({
          signer: account,
          // Missing both walletAddress and deploymentOwners
        }),
      ).rejects.toThrow(
        'Either walletAddress or deploymentOwners array must be provided to locate the smart wallet',
      );
    });

    it('should get a smart wallet with explicit wallet address', async () => {
      const getSmartWalletSpy = vi.spyOn(walletProvider, 'getSmartWallet');

      const embeddedWallet = await embeddedWalletProvider.createWallet();
      const account = await embeddedWallet.account();
      const walletAddress = getRandomAddress();
      const signerOwnerIndex = 0;
      const params = {
        signer: account,
        walletAddress,
        signerOwnerIndex,
      };

      const smartWallet = await walletNamespace.getSmartWallet(params);

      expect(smartWallet).toBeInstanceOf(DefaultSmartWallet);
      expect(getSmartWalletSpy).toHaveBeenCalledWith(params);
    });
  });
});
