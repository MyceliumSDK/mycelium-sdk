import { pad, type Address, type LocalAccount } from 'viem';
import { type WebAuthnAccount } from 'viem/account-abstraction';

import { smartWalletFactoryAbi } from '@/abis/smartWalletFactory';
import { smartWalletFactoryAddress } from '@/constants/addresses';
import type { ChainManager } from '@/tools/ChainManager';
import { DefaultSmartWallet } from '@/wallet/DefaultSmartWallet';
import { SmartWalletProvider } from '@/wallet/base/providers/SmartWalletProvider';
import type { CoinbaseCDP } from '@/tools/CoinbaseCDP';
import type { BaseProtocol } from '@/protocols/base/BaseProtocol';

/**
 * Default provider for creating and managing ERC-4337 smart wallets
 *
 * @internal
 * @category Wallets
 * @remarks
 * Factory that composes {@link DefaultSmartWallet} instances
 * Handles deterministic address prediction and instance construction
 */
export class DefaultSmartWalletProvider extends SmartWalletProvider {
  /** Manages supported blockchain networks */
  private chainManager: ChainManager;

  /** Already initialized protocol provider instance */
  private protocolProvider: BaseProtocol;

  /** Coinbase CDP instance to interact with Coinbase CDP API */
  private coinbaseCDP: CoinbaseCDP | null;

  /**
   * Initializes the smart wallet provider
   *
   * @internal
   * @param chainManager Manager for chains and viem clients
   * @param protocol Selected protocol descriptor that exposes an initialized instance
   */
  constructor(chainManager: ChainManager, protocol: BaseProtocol, coinbaseCDP: CoinbaseCDP | null) {
    super();
    this.chainManager = chainManager;
    this.protocolProvider = protocol;
    this.coinbaseCDP = coinbaseCDP;
  }

  /**
   * Creates a new smart wallet instance that deploys on first use
   *
   * @internal
   * @category Creation
   * @remarks
   * Address is derived deterministically from `owners` and `nonce`
   *
   * @param params Parameters for wallet creation
   * @param params.owners Owners as EVM addresses or WebAuthn owners
   * @param params.signer Local account used to sign UserOperations and transactions
   * @param params.nonce Optional salt for deterministic address calculation, default 0
   * @returns Promise that resolves to a {@link DefaultSmartWallet} instance
   */
  async createWallet(params: {
    owners: Array<Address | WebAuthnAccount>;
    signer: LocalAccount;
    nonce?: bigint;
  }): Promise<DefaultSmartWallet> {
    const { owners, signer, nonce } = params;
    return new DefaultSmartWallet(
      owners,
      signer,
      this.chainManager,
      this.protocolProvider,
      this.coinbaseCDP,
      undefined,
      undefined,
      nonce,
    );
  }

  /**
   * Predicts the deterministic smart wallet address for the given owners and nonce
   *
   * @internal
   * @category Addressing
   * @remarks
   * Uses the smart wallet factory `getAddress` to compute the CREATE2 address
   *
   * @param params Address prediction parameters
   * @param params.owners Owners as EVM addresses or WebAuthn owners
   * @param params.nonce Optional salt for deterministic address calculation, default 0
   * @returns Promise that resolves to the predicted wallet address
   * @throws Error if no supported chains are configured
   * @throws Error if an owner has an invalid type
   */
  async getWalletAddress(params: { owners: Array<Address | WebAuthnAccount>; nonce?: bigint }) {
    const { owners, nonce = 0n } = params;
    const owners_bytes = owners.map((owner) => {
      if (typeof owner === 'string') {
        return pad(owner);
      }
      if (owner.type === 'webAuthn') {
        return owner.publicKey;
      }
      throw new Error('invalid owner type');
    });

    // Factory is the same accross all chains, so we can use the first chain to get the wallet address
    const supportedChain = this.chainManager.getSupportedChain();
    if (!supportedChain) {
      throw new Error('No supported chains configured');
    }
    const publicClient = this.chainManager.getPublicClient(supportedChain);
    const smartWalletAddress = await publicClient.readContract({
      abi: smartWalletFactoryAbi,
      address: smartWalletFactoryAddress,
      functionName: 'getAddress',
      args: [owners_bytes, nonce],
    });
    return smartWalletAddress;
  }

  /**
   * Returns a smart wallet instance for an already deployed address
   *
   * @internal
   * @category Retrieval
   * @remarks
   * Use when you already know the deployment address and want an instance bound to a signer
   *
   * @param params Retrieval parameters
   * @param params.walletAddress Deployed smart wallet address
   * @param params.signer Local account to operate the wallet
   * @param params.ownerIndex Optional index of `signer` within the current owners set, default 0
   * @returns A {@link DefaultSmartWallet} instance
   */
  getWallet(params: {
    walletAddress: Address;
    signer: LocalAccount;
    ownerIndex?: number;
  }): DefaultSmartWallet {
    const { walletAddress, signer, ownerIndex } = params;
    return new DefaultSmartWallet(
      [signer.address],
      signer,
      this.chainManager,
      this.protocolProvider,
      this.coinbaseCDP,
      walletAddress,
      ownerIndex,
    );
  }
}
