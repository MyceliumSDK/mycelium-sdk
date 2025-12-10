import type { ChainConfig } from '@/types/chain';
import type { ProtocolsSecurityConfig } from '@/types/protocols/general';

/**
 * Mycelium SDK configuration
 * Configuration object for initializing the Mycelium SDK
 * @category Types
 * @example
 * ```ts
 * {
 *   walletsConfig: {
 *     embeddedWalletConfig: {
 *       provider: {
 *         type: 'privy',
 *         providerConfig: {
 *           appId: process.env.NEXT_PUBLIC_PRIVY_APP_ID!,
 *           appSecret: process.env.NEXT_PUBLIC_PRIVY_APP_SECRET!,
 *         },
 *       },
 *     },
 *     smartWalletConfig: {
 *       provider: {
 *         type: 'default',
 *       },
 *     },
 *   },
 *   chain: {
 *     chainId: parseInt(process.env.NEXT_PUBLIC_CHAIN_ID!),
 *     rpcUrl: process.env.NEXT_PUBLIC_RPC_URL!,
 *     bundlerUrl: process.env.NEXT_PUBLIC_BUNDLER_URL!,
 *   },
 *   protocolsRouterConfig: {
 *     riskLevel: 'low',
 *   },
 *   coinbaseCDPConfig: {
 *     apiKeyId: process.env.NEXT_PUBLIC_COINBASE_CDP_API_KEY_ID!,
 *     apiKeySecret: process.env.NEXT_PUBLIC_COINBASE_CDP_API_KEY_SECRET!,
 *   },
 * }
 * ```
 */
export interface MyceliumSDKConfig {
  /**
   * Wallet configuration
   * @remarks
   * Settings for embedded wallets and smart account providers. Currently support only Privy provider with their API keys
   * */
  walletsConfig: WalletConfig;

  /**
   * Unique identifier for the SDK integrator
   * @remarks
   * Used for Coinbase CDP API, and internally for tracking the usage of the SDK
   */
  integratorId: string;
  /**
   * Chains to use for the SDK
   * @remarks
   * If no rpcUrl, bundlerUrl and chain id are not provided, the SDK will use Base chain by default and its public RPC and Bundler URLs
   * */
  chain?: ChainConfig;
  /**
   * Protocols router configuration with different protocol based params
   * @remarks
   * If an integrator is not provided any requirements, `low` risk level protocols will be used by default
   */
  protocolsSecurityConfig?: ProtocolsSecurityConfig;
  /**
   * Coinbase CDP configuration
   * @remarks
   * The configuration is used to interact with Coinbase CDP API
   * If the configuration is not provided, the Coinbase CDP functionality will be disabled.
   * Calling all Coinbase CDP related methods will throw an error
   * Currently used for on/off ramp functionality for a wallet
   */
  coinbaseCDPConfig?: CoinbaseCDPConfig;
}

/**
 * Basic Mycelium SDK configuration for a case when a user provided only API key without advanced configurations
 */
export interface BasicMyceliumSDKConfig {
  apiKey: string;
  chainId?: number;
  protocolsSecurityConfig: ProtocolsSecurityConfig;
  overrides?: Partial<MyceliumSDKConfig>;
}

/**
 * Coinbase CDP configuration
 * Configuration for Coinbase CDP API
 * @see {@link https://docs.cdp.coinbase.com/api-reference/v2/introduction} Coinbase CDP API documentation
 */
export interface CoinbaseCDPConfig {
  /**
   * Coinbase CDP API key ID   */
  apiKeyId: string;
  /**
   * Coinbase CDP API key secret
   */
  apiKeySecret: string;
}

/**
 * Wallet configuration
 *  Configuration for wallet providers
 */
export type WalletConfig = {
  /** Embedded wallet configuration */
  embeddedWalletConfig: EmbeddedWalletConfig;
  /** Smart wallet configuration for ERC-4337 infrastructure */
  smartWalletConfig: SmartWalletConfig;
};

/**
 * Embedded wallet configuration
 *  Configuration for embedded wallets / signers
 */
export interface EmbeddedWalletConfig {
  /** Wallet provider for account creation, management, and signing */
  provider: EmbeddedWalletProviderConfig;
}

/**
 * Smart Wallet configuration
 *  Configuration for ERC-4337 smart wallets.
 */
export interface SmartWalletConfig {
  /** Wallet provider for smart wallet management */
  provider: SmartWalletProvider;
}

/**
 * Smart wallet provider configurations
 *  Union type supporting multiple wallet provider implementations
 */
export type SmartWalletProvider = DefaultSmartWalletProvider;

/**
 * Default smart wallet provider configuration
 *  Built-in provider smart wallet provider.
 */
export interface DefaultSmartWalletProvider {
  type: 'default';
}

/**
 * Embedded wallet provider configurations
 *  Union type supporting multiple embedded wallet providers
 */
export type EmbeddedWalletProviderConfig = PrivyEmbeddedWalletProviderConfig;

/** Privy embedded wallet provider configuration */
export interface PrivyEmbeddedWalletProviderConfig {
  /** Embedded wallet provider type */
  type: 'privy';
  /** Privy client provider config */
  providerConfig: {
    /** Privy params */
    appId: string;
    /** Privy party app secret */
    appSecret: string;
  };
}
