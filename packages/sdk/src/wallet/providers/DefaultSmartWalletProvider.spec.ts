import { type Address, type LocalAccount, pad } from 'viem';
import { type WebAuthnAccount } from 'viem/account-abstraction';
import { describe, expect, it, vi } from 'vitest';

import { smartWalletFactoryAbi } from '@mycelium/sdk/abis/smartWalletFactory';
import { smartWalletFactoryAddress } from '@mycelium/sdk/constants/addresses';
import type { ChainManager } from '@mycelium/sdk/tools/ChainManager';
import { createMockChainManager } from '@mycelium/sdk/test/mocks/ChainManagerMock';
import { getRandomAddress } from '@mycelium/sdk/test/utils';
import { DefaultSmartWallet } from '@mycelium/sdk/wallet/DefaultSmartWallet';
import { DefaultSmartWalletProvider } from '@mycelium/sdk/wallet/providers/DefaultSmartWalletProvider';
import { createMockProtocol } from '@mycelium/sdk/test/mocks/ProtocolMock';
import { createMockCoinbaseCDP } from '@mycelium/sdk/test/mocks/CoinbaseCDPMock';
import type { CoinbaseCDP } from '@mycelium/sdk/tools/CoinbaseCDP';

const mockChainManager = createMockChainManager() as unknown as ChainManager;
const mockProtocol = createMockProtocol();
const mockCoinbaseCDP: CoinbaseCDP = createMockCoinbaseCDP();
const mockSigner: LocalAccount = {
  address: getRandomAddress(),
  type: 'local',
} as unknown as LocalAccount;

describe('DefaultSmartWalletProvider integration tests', () => {
  it('should create a wallet with correct parameters', async () => {
    const provider = new DefaultSmartWalletProvider(
      mockChainManager,
      mockProtocol,
      mockCoinbaseCDP,
    );
    const owners = [getRandomAddress(), getRandomAddress()];
    const nonce = BigInt(123);

    const wallet = await provider.createWallet({
      owners,
      signer: mockSigner,
      nonce,
    });

    expect(wallet).toBeInstanceOf(DefaultSmartWallet);
    expect(wallet.signer).toBe(mockSigner);
  });

  it('should get wallet address with correct contract call', async () => {
    const provider = new DefaultSmartWalletProvider(
      mockChainManager,
      mockProtocol,
      mockCoinbaseCDP,
    );
    const owners = [getRandomAddress(), getRandomAddress()];
    const nonce = BigInt(456);
    const mockAddress = getRandomAddress();

    const publicClient = vi.mocked(mockChainManager.getPublicClient(1));
    publicClient.readContract = vi.fn().mockResolvedValue(mockAddress);

    const address = await provider.getWalletAddress({ owners, nonce });

    expect(address).toBe(mockAddress);
    expect(publicClient.readContract).toHaveBeenCalledWith({
      abi: smartWalletFactoryAbi,
      address: smartWalletFactoryAddress,
      functionName: 'getAddress',
      args: [owners.map((owner) => pad(owner)), nonce],
    });
  });

  it('should get wallet address with default nonce', async () => {
    const provider = new DefaultSmartWalletProvider(
      mockChainManager,
      mockProtocol,
      mockCoinbaseCDP,
    );
    const owners = [getRandomAddress()];
    const mockAddress = getRandomAddress();

    const publicClient = vi.mocked(mockChainManager.getPublicClient(1));
    publicClient.readContract = vi.fn().mockResolvedValue(mockAddress);

    const address = await provider.getWalletAddress({ owners });

    expect(address).toBe(mockAddress);
    expect(publicClient.readContract).toHaveBeenCalledWith({
      abi: smartWalletFactoryAbi,
      address: smartWalletFactoryAddress,
      functionName: 'getAddress',
      args: [owners.map((owner) => pad(owner)), BigInt(0)],
    });
  });

  it('should handle WebAuthn accounts in wallet address calculation', async () => {
    const provider = new DefaultSmartWalletProvider(
      mockChainManager,
      mockProtocol,
      mockCoinbaseCDP,
    );
    const webAuthnAccount: WebAuthnAccount = {
      type: 'webAuthn',
      publicKey: '0x123456789abcdef',
    } as unknown as WebAuthnAccount;
    const owners = [getRandomAddress(), webAuthnAccount];
    const mockAddress = getRandomAddress();

    const publicClient = vi.mocked(mockChainManager.getPublicClient(1));
    publicClient.readContract = vi.fn().mockResolvedValue(mockAddress);

    const address = await provider.getWalletAddress({ owners });

    expect(address).toBe(mockAddress);
    expect(publicClient.readContract).toHaveBeenCalledWith({
      abi: smartWalletFactoryAbi,
      address: smartWalletFactoryAddress,
      functionName: 'getAddress',
      args: [[pad(owners[0] as Address), webAuthnAccount.publicKey], BigInt(0)],
    });
  });

  it('should throw error for invalid owner type', async () => {
    const provider = new DefaultSmartWalletProvider(
      mockChainManager,
      mockProtocol,
      mockCoinbaseCDP,
    );
    const invalidOwner = { type: 'invalid' } as any;
    const owners = [invalidOwner];

    await expect(provider.getWalletAddress({ owners })).rejects.toThrow('invalid owner type');
  });

  it('should get existing wallet', async () => {
    const provider = new DefaultSmartWalletProvider(
      mockChainManager,
      mockProtocol,
      mockCoinbaseCDP,
    );
    const walletAddress = getRandomAddress();
    const ownerIndex = 2;

    const wallet = provider.getWallet({
      walletAddress,
      signer: mockSigner,
      ownerIndex,
    });

    expect(wallet).toBeInstanceOf(DefaultSmartWallet);
    expect(wallet.signer).toBe(mockSigner);
    const actualWalletAddress = await wallet.getAddress();
    expect(actualWalletAddress).toBe(walletAddress);
  });
});
