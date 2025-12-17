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
import { WalletProvider } from '@mycelium/sdk/wallet/WalletProvider';
import { createMockProtocol } from '@mycelium/sdk/test/mocks/ProtocolMock';
import { createMockCoinbaseCDP } from '@mycelium/sdk/test/mocks/CoinbaseCDPMock';

describe('WalletProvider integration tests', () => {
  let mockChainManager: ChainManager;
  let mockProtocol: ReturnType<typeof createMockProtocol>;
  let mockCoinbaseCDP: ReturnType<typeof createMockCoinbaseCDP>;
  let mockPrivyClient: ReturnType<typeof createMockPrivyClient>;
  let embeddedWalletProvider: PrivyEmbeddedWalletProvider;
  let smartWalletProvider: DefaultSmartWalletProvider;
  let walletProvider: WalletProvider;

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
  });

  describe('createEmbeddedWallet', () => {
    it('should create an embedded wallet via provider', async () => {
      const createWalletSpy = vi.spyOn(embeddedWalletProvider, 'createWallet');

      const wallet: PrivyWallet = (await walletProvider.createEmbeddedWallet()) as PrivyWallet;

      expect(wallet).toBeInstanceOf(PrivyWallet);
      expect(wallet.walletId).toMatch(/^mock-wallet-\d+$/);
      expect(isAddress(wallet.address)).toBe(true);
      expect(createWalletSpy).toHaveBeenCalledOnce();
    });
  });

  describe('createSmartWallet', () => {
    it('should create a smart wallet with provided signer and owners', async () => {
      const createWalletSpy = vi.spyOn(smartWalletProvider, 'createWallet');

      const embeddedWallet = await embeddedWalletProvider.createWallet();
      const account = await embeddedWallet.account();
      const owners = [getRandomAddress(), embeddedWallet.address];
      const nonce = BigInt(123);

      const smartWallet = await walletProvider.createSmartWallet({
        owners,
        signer: account,
        nonce,
      });

      expect(smartWallet).toBeInstanceOf(DefaultSmartWallet);
      expect(smartWallet.signer).toBe(account);
      expect(createWalletSpy).toHaveBeenCalledWith({
        owners,
        signer: account,
        nonce,
      });
    });
  });

  describe('createAccount', () => {
    it('should create a wallet with embedded signer (default owners)', async () => {
      const mockSignerAddress = getRandomAddress();
      const mockEmbeddedWallet = {
        walletId: 'mock-wallet-1',
        address: mockSignerAddress,
        account: async () => {
          return {
            address: mockSignerAddress,
          };
        },
      } as unknown as PrivyWallet;

      const embeddedCreateWalletSpy = vi
        .spyOn(embeddedWalletProvider, 'createWallet')
        .mockResolvedValue(mockEmbeddedWallet);
      const smartCreateWalletSpy = vi.spyOn(smartWalletProvider, 'createWallet');

      const account = await walletProvider.createAccount();

      expect(account.smartWallet).toBeInstanceOf(DefaultSmartWallet);
      expect(account.embeddedWalletId).toBe('mock-wallet-1');
      expect(embeddedCreateWalletSpy).toHaveBeenCalledOnce();
      expect(smartCreateWalletSpy).toHaveBeenCalledWith({
        owners: [mockSignerAddress],
        signer: await mockEmbeddedWallet.account(),
        nonce: undefined,
      });
    });

    it('should create a wallet with embedded signer and additional owners', async () => {
      const mockSignerAddress = getRandomAddress();
      const mockEmbeddedWallet = {
        walletId: 'mock-wallet-1',
        address: mockSignerAddress,
        account: async () => {
          return {
            address: mockSignerAddress,
          };
        },
      } as unknown as PrivyWallet;

      const embeddedCreateWalletSpy = vi
        .spyOn(embeddedWalletProvider, 'createWallet')
        .mockResolvedValue(mockEmbeddedWallet);
      const smartCreateWalletSpy = vi.spyOn(smartWalletProvider, 'createWallet');

      const additionalOwners = [getRandomAddress(), getRandomAddress()];
      const embeddedWalletIndex = 1;
      const nonce = BigInt(456);

      const result = await walletProvider.createAccount({
        owners: additionalOwners,
        embeddedWalletIndex,
        nonce,
      });

      expect(result.smartWallet).toBeInstanceOf(DefaultSmartWallet);
      expect(result.embeddedWalletId).toBe('mock-wallet-1');
      expect(embeddedCreateWalletSpy).toHaveBeenCalledOnce();
      expect(smartCreateWalletSpy).toHaveBeenCalledWith({
        owners: [additionalOwners[0], mockSignerAddress, additionalOwners[1]],
        signer: await mockEmbeddedWallet.account(),
        nonce,
      });
    });

    it('should create a wallet with embedded signer and additional owners with no specified index', async () => {
      const mockSignerAddress = getRandomAddress();
      const mockEmbeddedWallet = {
        walletId: 'mock-wallet-1',
        address: mockSignerAddress,
        account: async () => {
          return {
            address: mockSignerAddress,
          };
        },
      } as unknown as PrivyWallet;

      const embeddedCreateWalletSpy = vi
        .spyOn(embeddedWalletProvider, 'createWallet')
        .mockResolvedValue(mockEmbeddedWallet);
      const smartCreateWalletSpy = vi.spyOn(smartWalletProvider, 'createWallet');

      const additionalOwners = [getRandomAddress(), getRandomAddress()];
      const nonce = BigInt(456);

      const result = await walletProvider.createAccount({
        owners: additionalOwners,
        nonce,
      });

      expect(result.smartWallet).toBeInstanceOf(DefaultSmartWallet);
      expect(result.embeddedWalletId).toBe('mock-wallet-1');
      expect(embeddedCreateWalletSpy).toHaveBeenCalledOnce();
      expect(smartCreateWalletSpy).toHaveBeenCalledWith({
        owners: [additionalOwners[0], additionalOwners[1], mockSignerAddress],
        signer: await mockEmbeddedWallet.account(),
        nonce,
      });
    });

    it('should throw error when embedded wallet has no walletId', async () => {
      const mockSignerAddress = getRandomAddress();
      const mockEmbeddedWallet = {
        walletId: undefined,
        address: mockSignerAddress,
        account: async () => {
          return {
            address: mockSignerAddress,
          };
        },
      } as unknown as PrivyWallet;

      vi.spyOn(embeddedWalletProvider, 'createWallet').mockResolvedValue(mockEmbeddedWallet);

      await expect(walletProvider.createAccount()).rejects.toThrow(
        'Failed to create embedded wallet. No wallet ID returned',
      );
    });
  });

  describe('getEmbeddedWallet', () => {
    it('should get an embedded wallet by ID', async () => {
      const getWalletSpy = vi.spyOn(embeddedWalletProvider, 'getWallet');

      const createdWallet = await embeddedWalletProvider.createWallet();
      const walletId = createdWallet.walletId;

      const wallet: PrivyWallet = (await walletProvider.getEmbeddedWallet({
        walletId,
      })) as PrivyWallet;

      expect(wallet).toBeInstanceOf(PrivyWallet);
      expect(wallet.walletId).toBe(walletId);
      expect(getWalletSpy).toHaveBeenCalledWith({ walletId });
    });
  });

  describe('getAccount', () => {
    it('should get a smart wallet with embedded signer and deployment owners', async () => {
      const mockSignerAddress = getRandomAddress();
      const mockSigner = {
        address: mockSignerAddress,
      };
      const mockEmbeddedWallet = {
        walletId: 'mock-wallet-1',
        address: mockSignerAddress,
        account: async () => mockSigner,
      } as unknown as PrivyWallet;

      const embeddedGetWalletSpy = vi
        .spyOn(embeddedWalletProvider, 'getWallet')
        .mockResolvedValue(mockEmbeddedWallet);
      const smartGetWalletSpy = vi.spyOn(smartWalletProvider, 'getWallet');
      const mockWalletAddress = getRandomAddress();

      vi.spyOn(smartWalletProvider, 'getWalletAddress').mockResolvedValue(mockWalletAddress);

      const walletId = 'mock-wallet-1';
      const deploymentOwners = [mockSignerAddress];
      const signerOwnerIndex = 0;

      const smartWallet = await walletProvider.getAccount({
        walletId,
        deploymentOwners,
        signerOwnerIndex,
      });

      expect(smartWallet).toBeInstanceOf(DefaultSmartWallet);
      expect(embeddedGetWalletSpy).toHaveBeenCalledWith({ walletId });
      expect(smartGetWalletSpy).toHaveBeenCalledWith({
        walletAddress: mockWalletAddress,
        signer: mockSigner,
        ownerIndex: signerOwnerIndex,
      });
    });

    it('should get a smart wallet with embedded signer using explicit wallet address', async () => {
      const mockSignerAddress = getRandomAddress();
      const mockSigner = {
        address: mockSignerAddress,
      };
      const mockEmbeddedWallet = {
        walletId: 'mock-wallet-1',
        address: mockSignerAddress,
        account: async () => mockSigner,
      } as unknown as PrivyWallet;

      const embeddedGetWalletSpy = vi
        .spyOn(embeddedWalletProvider, 'getWallet')
        .mockResolvedValue(mockEmbeddedWallet);
      const smartGetWalletSpy = vi.spyOn(smartWalletProvider, 'getWallet');
      const mockWalletAddress = getRandomAddress();

      const walletId = 'mock-wallet-1';
      const walletAddress = mockWalletAddress;
      const signerOwnerIndex = 0;

      const smartWallet = await walletProvider.getAccount({
        walletId,
        walletAddress,
        signerOwnerIndex,
      });

      expect(smartWallet).toBeInstanceOf(DefaultSmartWallet);
      expect(embeddedGetWalletSpy).toHaveBeenCalledWith({ walletId });
      expect(smartGetWalletSpy).toHaveBeenCalledWith({
        walletAddress,
        signer: mockSigner,
        ownerIndex: signerOwnerIndex,
      });
    });

    it('should default to embedded wallet as single owner when neither walletAddress nor deploymentOwners provided', async () => {
      const mockSignerAddress = getRandomAddress();
      const mockSigner = {
        address: mockSignerAddress,
      };
      const mockEmbeddedWallet = {
        walletId: 'mock-wallet-1',
        address: mockSignerAddress,
        account: async () => mockSigner,
      } as unknown as PrivyWallet;

      const embeddedGetWalletSpy = vi
        .spyOn(embeddedWalletProvider, 'getWallet')
        .mockResolvedValue(mockEmbeddedWallet);
      const smartGetWalletSpy = vi.spyOn(smartWalletProvider, 'getWallet');
      const mockWalletAddress = getRandomAddress();

      vi.spyOn(smartWalletProvider, 'getWalletAddress').mockResolvedValue(mockWalletAddress);

      const walletId = 'mock-wallet-1';
      const signerOwnerIndex = 0;

      const smartWallet = await walletProvider.getAccount({
        walletId,
        signerOwnerIndex,
      });

      expect(smartWallet).toBeInstanceOf(DefaultSmartWallet);
      expect(embeddedGetWalletSpy).toHaveBeenCalledWith({ walletId });
      expect(smartGetWalletSpy).toHaveBeenCalledWith({
        walletAddress: mockWalletAddress,
        signer: mockSigner,
        ownerIndex: signerOwnerIndex,
      });
    });

    it('should throw error when embedded wallet is not found', async () => {
      const invalidWalletId = 'invalid-wallet-id';

      await expect(
        walletProvider.getAccount({
          walletId: invalidWalletId,
        }),
      ).rejects.toThrow('Failed to get wallet with id: invalid-wallet-id');
    });

    it('should throw error when embedded wallet returns null', async () => {
      const walletId = 'non-existent-wallet';
      vi.spyOn(embeddedWalletProvider, 'getWallet').mockResolvedValue(null as any);

      await expect(
        walletProvider.getAccount({
          walletId,
        }),
      ).rejects.toThrow('Embedded wallet not found');
    });
  });

  describe('getSmartWallet', () => {
    it('should get a smart wallet with provided signer and deployment owners', async () => {
      const mockWalletAddress = getRandomAddress();
      const getWalletAddressSpy = vi
        .spyOn(smartWalletProvider, 'getWalletAddress')
        .mockResolvedValue(mockWalletAddress);
      const getWalletSpy = vi.spyOn(smartWalletProvider, 'getWallet');

      const embeddedWallet = await embeddedWalletProvider.createWallet();
      const account = await embeddedWallet.account();
      const deploymentOwners = [embeddedWallet.address, getRandomAddress()];
      const signerOwnerIndex = 0;
      const nonce = BigInt(789);

      const smartWallet = await walletProvider.getSmartWallet({
        signer: account,
        deploymentOwners,
        signerOwnerIndex,
        nonce,
      });

      expect(smartWallet).toBeInstanceOf(DefaultSmartWallet);
      expect(getWalletAddressSpy).toHaveBeenCalledWith({
        owners: deploymentOwners,
        nonce,
      });
      expect(getWalletSpy).toHaveBeenCalledWith({
        walletAddress: mockWalletAddress,
        signer: account,
        ownerIndex: signerOwnerIndex,
      });
    });

    it('should get a smart wallet with provided signer and explicit wallet address', async () => {
      const getWalletSpy = vi.spyOn(smartWalletProvider, 'getWallet');
      const mockWalletAddress = getRandomAddress();

      const embeddedWallet = await embeddedWalletProvider.createWallet();
      const account = await embeddedWallet.account();
      const signerOwnerIndex = 0;

      const smartWallet = await walletProvider.getSmartWallet({
        signer: account,
        walletAddress: mockWalletAddress,
        signerOwnerIndex,
      });

      expect(smartWallet).toBeInstanceOf(DefaultSmartWallet);
      expect(getWalletSpy).toHaveBeenCalledWith({
        walletAddress: mockWalletAddress,
        signer: account,
        ownerIndex: signerOwnerIndex,
      });
    });

    it('should throw error when getting smart wallet without required parameters', async () => {
      const embeddedWallet = await embeddedWalletProvider.createWallet();
      const account = await embeddedWallet.account();

      await expect(
        walletProvider.getSmartWallet({
          signer: account,
          // Missing both walletAddress and deploymentOwners
        }),
      ).rejects.toThrow(
        'Either walletAddress or deploymentOwners array must be provided to locate the smart wallet',
      );
    });
  });
});
