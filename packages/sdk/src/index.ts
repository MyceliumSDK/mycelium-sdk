/**
 * @packageDocumentation
 * Entry point for the Mycelium SDK
 *
 * Exports stable types and the main SDK facade (`MyceliumSDK`)
 * Internal base classes and implementations are not part of the public API
 * and are hidden from public documentation
 */

export * from '@/public/types';

/** @internal */
export { DefaultSmartWallet } from '@/wallet/DefaultSmartWallet';
export { FundingNamespace } from '@/ramp/FundingNamespace';

import { ChainManager } from '@/tools/ChainManager';
import type { SmartWalletProvider } from '@/wallet/base/providers/SmartWalletProvider';
import { WalletNamespace } from '@/wallet/WalletNamespace';
import { type BasicMyceliumSDKConfig, type MyceliumSDKConfig } from '@/types/sdk';
import { base } from 'viem/chains';
import { DefaultSmartWalletProvider } from '@/wallet/providers/DefaultSmartWalletProvider';
import { WalletProvider } from '@/wallet/WalletProvider';
import type { EmbeddedWalletProvider } from '@/wallet/base/providers/EmbeddedWalletProvider';
import { PrivyEmbeddedWalletProvider } from '@/wallet/providers/PrivyEmbeddedWalletProvider';
import { PrivyClient } from '@privy-io/server-auth';
import { ProtocolRouter } from '@/router/ProtocolRouter';
import { CoinbaseCDP, type CoinbaseCDP as CoinbaseCDPType } from '@/tools/CoinbaseCDP';
import { FundingNamespace } from '@/ramp/FundingNamespace';
import type { BaseProtocol } from '@/protocols/base/BaseProtocol';
import { ProtocolsNamespace } from '@/protocols/ProtocolsNamespace';
import { ApiClient } from '@/tools/ApiClient';
import type { OnchainConfig } from '@/types/api';

/**
 * Main SDK facade for integrating wallets and protocols.
 *
 * @public
 * @category 1. Getting started
 * @remarks
 * This class encapsulates:
 * - protocol selection and initialization
 * - chain/network management (`ChainManager`),
 * - public wallet namespace (accessible through {@link MyceliumSDK.wallet | wallet}).
 *
 * By default, if no chain config is provided, it uses the public RPC
 * and Bundler for the Base chain
 *
 * The SDK can be initialized in two ways:
 * 1. With an API key - fetches configuration from backend automatically
 * 2. With full configuration - uses provided configuration directly
 *
 * @example
 *
 * import { MyceliumSDK, type MyceliumSDKConfig, type BasicMyceliumSDKConfig } from '@mycelium-sdk/core';
 *
 * // Option 1: Initialize with API key (fetches config from backend)
 * const sdk = await MyceliumSDK.init({
 *   apiKey: 'sk_...'
 * });
 *
 * // Option 2: Initialize with full configuration
 * const config: MyceliumSDKConfig = {
 *   walletsConfig: { /* ... *\/ },
 *   protocolsSecurityConfig: { riskLevel: 'low' },
 *   chain: { /* ... *\/ },
 *   coinbaseCDPConfig: { /* ... *\/ },
 *   integratorId: 'MyceliumApp',
 * };
 * const sdk = await MyceliumSDK.init(config);
 *
 * const {embeddedWalletId, smartWallet} = await sdk.wallet.createAccount();
 * const balance = await smartWallet.getBalance();
 *  */
export class MyceliumSDK {
  /**
   * Returns a unified wallet namespace to manage embedded/smart wallets and related operations
   * @public
   * @category Wallets
   */
  public readonly wallet: WalletNamespace;

  /**
   * Protocol namespace to manage protocol related operations
   * @public
   * @category Protocols
   */
  public readonly protocols: ProtocolsNamespace;

  /**
   * Ramp namespace to manage ramp operations. Methods are available on {@link RampNamespace}
   * @internal
   * @remarks
   * If the Coinbase CDP configuration is not provided, the ramp functionality will be disabled.
   * Calling the respective method will throw an error
   * @category Tools
   */
  public readonly fundingNamespace: FundingNamespace | null = null;

  /**
   * Chain manager instance to manage chain related entities
   * @internal
   */
  private _chainManager: ChainManager;

  /** @internal */
  private embeddedWalletProvider!: EmbeddedWalletProvider;

  /** @internal */
  private smartWalletProvider!: SmartWalletProvider;

  /**
   * Protocol instance to perform earn related operations with a selected protocol
   * @internal
   */
  private protocol: BaseProtocol;

  /** API client for the backend API */
  apiClient: ApiClient | undefined;

  /**
   * Coinbase CDP instance to Coinbase related and onchain operations using Coinbase CDP API
   * @remarks
   * If the configuration is not provided, the Coinbase CDP functionality will be disabled.
   * Calling the respective method will throw an error.
   * @internal
   */
  private coinbaseCDP: CoinbaseCDPType | null = null;

  /**
   * Initializes the SDK
   * @param config SDK configuration (networks, wallets, protocol router settings)
   * @returns SDK instance
   */
  static async init(config: BasicMyceliumSDKConfig | MyceliumSDKConfig): Promise<MyceliumSDK> {
    let finalConfig: MyceliumSDKConfig;
    let isPremiumAvailable = false;

    if ('apiKey' in config && config.apiKey) {
      const apiClient = new ApiClient(config.apiKey);
      isPremiumAvailable = await apiClient.validate();

      if (isPremiumAvailable) {
        const apiResponse = await apiClient.sendRequest('config');

        if (!apiResponse.success) {
          throw new Error(apiResponse.error || 'Failed to get onchain config');
        }

        const backendConfig: OnchainConfig = apiResponse.data as unknown as OnchainConfig;

        finalConfig = {
          integratorId: backendConfig.integratorId,
          walletsConfig: {
            embeddedWalletConfig: {
              provider: {
                type: 'privy',
                providerConfig: {
                  appId: backendConfig.privyAppId,
                  appSecret: backendConfig.privyAppSecret,
                },
              },
            },
            smartWalletConfig: {
              provider: {
                type: 'default',
              },
            },
          },
          chain: {
            chainId: backendConfig.chainId,
            rpcUrl: backendConfig.rpcUrl,
            bundlerUrl: backendConfig.bundlerUrl,
          },
          protocolsSecurityConfig: config.protocolsSecurityConfig,
          coinbaseCDPConfig: {
            apiKeyId: backendConfig.coinbaseCdpApiKey,
            apiKeySecret: backendConfig.coinbaseCdpApiKeySecret,
          },
        };

        const sdk = new MyceliumSDK(finalConfig, isPremiumAvailable, apiClient);
        sdk.apiClient = apiClient;
        return sdk;
      }
    }

    finalConfig = config as MyceliumSDKConfig;

    const sdk = new MyceliumSDK(finalConfig, isPremiumAvailable);
    return sdk;
  }

  /**
   * Creates a new SDK instance
   *
   * @param config SDK configuration (networks, wallets, protocol router settings)
   * @throws Throws if an unsupported wallet provider is given
   * @see MyceliumSDKConfig
   */
  constructor(config: MyceliumSDKConfig, isPremiumAvailable: boolean, apiClient?: ApiClient) {
    this._chainManager = new ChainManager(
      config.chain || {
        chainId: base.id,
        rpcUrl: base.rpcUrls.default.http[0],
        bundlerUrl: 'https://public.pimlico.io/v2/8453/rpc',
      },
    );

    if (config.protocolsSecurityConfig) {
      // protocolsRouterConfig is the abstract settings that are clear for a dev, e.g. risk level, basic apy, etc
      this.protocol = this.selectProtocol(
        config.protocolsSecurityConfig,
        isPremiumAvailable,
        apiClient,
      );
    } else {
      throw new Error('Protocols router config is required');
    }

    if (config.coinbaseCDPConfig) {
      this.coinbaseCDP = new CoinbaseCDP(
        config.coinbaseCDPConfig.apiKeyId,
        config.coinbaseCDPConfig.apiKeySecret,
        config.integratorId,
        this.chainManager,
      );

      this.fundingNamespace = new FundingNamespace(this.coinbaseCDP);
    }

    this.wallet = this.createWalletNamespace(config.walletsConfig);

    this.protocols = new ProtocolsNamespace(this.protocol);
  }

  /**
   * Returns the chain manager instance for multi-chain operations
   * @public
   * @remarks
   * More about methods in {@link ChainManager}
   * @category Tools
   *
   * @returns ChainManager instance of the type {@link ChainManager}
   */
  get chainManager(): ChainManager {
    return this._chainManager;
  }

  /**
   * Returns a funding namespace to manage top ups & cash outs configurations
   * @public
   * @remarks
   * More about methods in {@link FundingNamespace}
   * @category Tools
   *
   * @returns Funding namespace of the type {@link FundingNamespace}
   */
  get funding(): FundingNamespace {
    if (!this.fundingNamespace) {
      throw new Error(
        'Ramp namespace is not initialized. Please, provide the configuration in the SDK initialization',
      );
    }

    return this.fundingNamespace;
  }

  /**
   * Recommends and initializes a protocol based on router settings
   *
   * @internal
   * @param config Protocol router configuration (e.g. risk level)
   * @returns Selected protocol object of the type {@link Protocol}
   */
  private selectProtocol(
    config: MyceliumSDKConfig['protocolsSecurityConfig'],
    isPremiumAvailable: boolean,
    apiClient?: ApiClient,
  ): BaseProtocol {
    const protocolRouter = new ProtocolRouter(this.chainManager, isPremiumAvailable);

    const protocol: BaseProtocol = protocolRouter.select();

    if (!config) {
      throw new Error('Protocols security config is required');
    }

    // console.log('protocol selected:', protocol);
    protocol.init(this.chainManager, config, apiClient);

    return protocol;
  }

  /**
   * Creates a wallet provider (embedded + smart) and combines them
   *
   * @internal
   * @param config Wallet configuration
   * @returns Configured {@link WalletProvider}
   * @throws If an unsupported wallet provider type is specified
   */
  private createWalletProvider(config: MyceliumSDKConfig['walletsConfig']) {
    if (config.embeddedWalletConfig.provider.type === 'privy') {
      const privyClient = new PrivyClient(
        config.embeddedWalletConfig.provider.providerConfig.appId,
        config.embeddedWalletConfig.provider.providerConfig.appSecret,
      );

      this.embeddedWalletProvider = new PrivyEmbeddedWalletProvider(
        privyClient,
        this._chainManager,
      );
    } else {
      throw new Error(
        `Unsupported embedded wallet provider: ${config.embeddedWalletConfig.provider.type}`,
      );
    }

    if (!config.smartWalletConfig || config.smartWalletConfig.provider.type === 'default') {
      this.smartWalletProvider = new DefaultSmartWalletProvider(
        this.chainManager,
        this.protocol,
        this.coinbaseCDP,
      );
    } else {
      throw new Error(
        `Unsupported smart wallet provider: ${config.smartWalletConfig.provider.type}`,
      );
    }

    const walletProvider = new WalletProvider(
      this.embeddedWalletProvider,
      this.smartWalletProvider,
    );

    return walletProvider;
  }

  /**
   * Creates the public wallet namespace
   *
   * @internal
   * @param config Wallet configuration.
   * @returns A {@link WalletNamespace} instance
   */
  private createWalletNamespace(config: MyceliumSDKConfig['walletsConfig']) {
    const walletProvider = this.createWalletProvider(config);
    return new WalletNamespace(walletProvider);
  }
}
