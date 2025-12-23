import type { Address } from 'viem';
import type { WebAuthnAccount } from 'viem/account-abstraction';

import type {
  CreateSmartWalletOptions,
  CreateAccountOptions,
  GetEmbeddedWalletOptions,
  GetSmartWalletOptions,
  GetAccountOptions,
  CreateAccountResult,
} from '@/types/wallet';
import type { EmbeddedWallet } from '@/wallet/base/wallets/EmbeddedWallet';
import type { SmartWallet } from '@/wallet/base/wallets/SmartWallet';
import type { EmbeddedWalletProvider } from '@/wallet/base/providers/EmbeddedWalletProvider';
import type { SmartWalletProvider } from '@/wallet/base/providers/SmartWalletProvider';

/**
 * Unified Wallet Provider class
 *
 * @internal
 * @category Wallets
 * @remarks
 * Internal facade that composes an embedded wallet provider and a smart wallet provider
 * and exposes higher-level creation/retrieval flows. Not exported from user's usage
 *
 * Used in a higher level class - {@link WalletNamespace}
 *
 * Typical flows:
 * - Create embedded wallet only: {@link createEmbeddedWallet}
 * - Create smart wallet only (you provide signer/owners): {@link createSmartWallet}
 * - Create smart wallet with embedded wallet as signer: {@link createWalletWithEmbeddedSigner}
 * - Get smart wallet using embedded wallet as signer: {@link getSmartWalletWithEmbeddedSigner}
 * - Get smart wallet using a provided signer: {@link getSmartWallet}
 */
export class WalletProvider {
  /**
   * Embedded wallet provider instance
   * @internal
   */
  public readonly embeddedWalletProvider: EmbeddedWalletProvider;

  /**
   * Smart wallet provider instance
   * @internal
   */
  public readonly smartWalletProvider: SmartWalletProvider;

  /**
   * Creates a unified wallet provider
   *
   * @internal
   * @param embeddedWalletProvider Provider for embedded wallet operations
   * @param smartWalletProvider Provider for smart wallet operations
   */
  constructor(
    embeddedWalletProvider: EmbeddedWalletProvider,
    smartWalletProvider: SmartWalletProvider,
  ) {
    this.embeddedWalletProvider = embeddedWalletProvider;
    this.smartWalletProvider = smartWalletProvider;
  }

  /**
   * Creates an embedded wallet
   *
   * @internal
   * @remarks
   * Thin wrapper around the embedded wallet provider’s `createWallet`
   *
   * @returns Promise that resolves to the newly created {@link EmbeddedWallet}
   */
  async createEmbeddedWallet(): Promise<EmbeddedWallet> {
    return this.embeddedWalletProvider.createWallet();
  }

  /**
   * Creates a smart wallet (you provide signer and owners)
   *
   * @internal
   * @remarks
   * Use when you already control a signer and want to create a smart
   * wallet without creating an embedded wallet
   *
   * @param params Smart wallet creation parameters
   * @param params.owners Owners array for the smart wallet (EVM addresses or WebAuthn owners)
   * @param params.signer Signer (local account) used for transactions
   * @param params.nonce Optional salt/nonce for deterministic address calculation (defaults to 0)
   * @returns Promise that resolves to the created {@link SmartWallet}
   */
  async createSmartWallet(params: CreateSmartWalletOptions): Promise<SmartWallet> {
    const { owners, signer, nonce } = params;

    return this.smartWalletProvider.createWallet({
      owners,
      signer,
      nonce,
    });
  }

  /**
   * Creates a smart wallet with an embedded wallet as signer
   *
   * @internal
   * @remarks
   * Creates an embedded wallet first, then inserts its address into the owners array
   * and uses its account as the signer for the smart wallet. Default SDK option, embedded wallets manager is necessary to be provided
   *
   * @param params Optional creation parameters
   * @param params.owners Optional additional owners. The embedded wallet address is inserted at the specified index
   * @param params.embeddedWalletIndex Optional index where the embedded wallet address should be inserted (defaults to the end)
   * @param params.nonce Optional salt/nonce for deterministic address calculation (defaults to 0)
   * @returns Promise that resolves to the created {@link SmartWallet}
   */
  async createAccount(params?: CreateAccountOptions): Promise<CreateAccountResult> {
    const { owners: ownersParam, embeddedWalletIndex, nonce } = params || {};
    const embeddedWallet = await this.embeddedWalletProvider.createWallet();

    if (!embeddedWallet.walletId) {
      throw new Error('Failed to create embedded wallet. No wallet ID returned');
    }

    const account = await embeddedWallet.account();

    let owners: Array<Address | WebAuthnAccount>;
    if (ownersParam) {
      owners = [...ownersParam]; // Create a copy to avoid mutating the original
      const insertIndex = embeddedWalletIndex ?? owners.length; // Default to end if not specified
      owners.splice(insertIndex, 0, embeddedWallet.address); // Insert embedded wallet at specified index
    } else {
      owners = [embeddedWallet.address]; // Default to just the embedded wallet
    }

    const smartWallet = await this.smartWalletProvider.createWallet({
      owners,
      signer: account,
      nonce,
    });

    return {
      embeddedWalletId: embeddedWallet.walletId,
      smartWallet,
    };
  }

  /**
   * Gets a unified web3 account: a smart wallet using an embedded wallet as the signer
   *
   * @internal
   * @remarks
   * Fetches an embedded wallet by `walletId` and uses it as signer.
   * If neither `walletAddress` nor `deploymentOwners` is provided, defaults to using
   * the embedded wallet as the single owner for deterministic address calculation
   *
   * @param params Retrieval parameters
   * @param params.walletId Embedded wallet ID used to locate the signer wallet
   * @param params.deploymentOwners Optional original deployment owners used for address calculation
   * @param params.signerOwnerIndex Index of the signer in the **current** owners set (defaults to 0)
   * @param params.walletAddress Optional explicit smart wallet address (skips calculation)
   * @param params.nonce Optional nonce used during original creation
   * @returns Promise that resolves to the {@link SmartWallet}
   * @throws Error if the embedded wallet cannot be found
   */
  async getAccount(params: GetAccountOptions) {
    const { walletId, deploymentOwners, walletAddress } = params;
    const embeddedWallet = await this.embeddedWalletProvider.getWallet({
      walletId,
    });
    if (!embeddedWallet) {
      throw new Error('Embedded wallet not found');
    }
    const account = await embeddedWallet.account();

    // If neither walletAddress nor deploymentOwners provided, default to embedded wallet as single owner
    const finalDeploymentOwners =
      deploymentOwners || (walletAddress ? undefined : [embeddedWallet.address]);

    return this.getSmartWallet({
      signer: account,
      ...params,
      deploymentOwners: finalDeploymentOwners,
    });
  }

  /**
   * Gets an existing embedded wallet by ID
   *
   * @internal
   * @param params Retrieval parameters
   * @param params.walletId Embedded wallet ID
   * @returns Promise that resolves to the {@link EmbeddedWallet}, or `null/undefined` per provider’s contract
   */
  async getEmbeddedWallet(params: GetEmbeddedWalletOptions) {
    const { walletId } = params;
    return this.embeddedWalletProvider.getWallet({
      walletId,
    });
  }

  /**
   * Gets a smart wallet using a provided signer
   *
   * @internal
   * @remarks
   * Use when you already control a `LocalAccount` signer
   * Requires either:
   * - `walletAddress`, or
   * - `deploymentOwners` (+ optional `nonce`) to deterministically derive the address
   *
   * @param params Retrieval parameters
   * @param params.signer Signer (local account)
   * @param params.deploymentOwners Original deployment owners (required if `walletAddress` is not provided)
   * @param params.signerOwnerIndex Index of `signer` within the **current** owners set (defaults to 0)
   * @param params.walletAddress Explicit smart wallet address (skips calculation)
   * @param params.nonce Optional nonce used during original creation
   * @returns Promise that resolves to the {@link SmartWallet}
   * @throws Error if neither `walletAddress` nor `deploymentOwners` is provided
   */
  async getSmartWallet(params: GetSmartWalletOptions) {
    const {
      signer,
      deploymentOwners,
      signerOwnerIndex,
      walletAddress: walletAddressParam,
      nonce,
    } = params;

    if (!walletAddressParam && !deploymentOwners) {
      try {
        throw new Error(
          'Either walletAddress or deploymentOwners array must be provided to locate the smart wallet',
        );
      } catch {
        throw new Error(
          'Either walletAddress or deploymentOwners array must be provided to locate the smart wallet',
        );
      }
    }

    const ownerIndex = signerOwnerIndex ?? 0;

    const walletAddress =
      walletAddressParam ||
      (await this.smartWalletProvider.getWalletAddress({
        // Safe to use ! since we validated above
        owners: deploymentOwners!,
        nonce,
      }));
    return this.smartWalletProvider.getWallet({
      walletAddress,
      signer,
      ownerIndex,
    });
  }
}
