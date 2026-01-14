import { type Chain, createPublicClient, http, type PublicClient } from 'viem';
import {
  type BundlerClient,
  type EntryPointVersion,
  type SmartAccount,
  createBundlerClient,
  entryPoint07Address,
} from 'viem/account-abstraction';
import { createPimlicoClient, type PimlicoClient } from 'permissionless/clients/pimlico';

import { type SUPPORTED_CHAIN_IDS, CHAINS_MAP } from '@/constants/chains';
import type { ChainConfig } from '@/types/chain';
import { chainById } from '@/utils/chains';

/**
 * Service for managing supported blockchain networks and their clients
 *
 * @internal
 * @category Infrastructure
 * @remarks
 * Provides RPC and bundler URL access, creates {@link PublicClient} and {@link BundlerClient} instances
 * Central point for chain-level configuration in the SDK
 */
export class ChainManager {
  /** Public client for the configured chain */
  private publicClient: PublicClient;
  /** Chain configuration */
  private chainConfigs: ChainConfig;
  /** Map of chain names to chain metadata */
  private chainNames: Record<string, Chain>;

  /**
   * Initializes the chain manager with the given configuration
   *
   * @internal
   * @param chains Configuration object for a supported chain
   */
  constructor(chains: ChainConfig) {
    this.chainConfigs = chains;
    this.publicClient = this.createPublicClient(chains);
    this.chainNames = CHAINS_MAP;
  }

  /**
   * Utility to validate if a string is a valid HTTP(S) URL
   *
   * @internal
   * @param url Candidate URL
   * @returns True if valid, false otherwise
   */
  private isValidUrl(url: string): boolean {
    return /^https?:\/\/.+$/.test(url);
  }

  /**
   * Returns a {@link PublicClient} for the given chain ID
   *
   * @internal
   * @category Clients
   * @param chainId Target chain ID
   * @returns {@link PublicClient} instance
   * @throws Error if client is not configured
   */
  getPublicClient(chainId: (typeof SUPPORTED_CHAIN_IDS)[number]): PublicClient {
    const client = this.publicClient;
    if (!client) {
      throw new Error(`No public client configured for chain ID: ${chainId}`);
    }
    return client;
  }

  /**
   * Returns a {@link BundlerClient} for the given chain ID
   *
   * @internal
   * @category Clients
   * @param chainId Target chain ID
   * @param account SmartAccount to bind to the bundler client
   * @returns {@link BundlerClient} instance
   * @throws Error if no bundler URL is configured
   */
  getBundlerClient(
    chainId: (typeof SUPPORTED_CHAIN_IDS)[number],
    account: SmartAccount,
  ): BundlerClient {
    const rpcUrl = this.getRpcUrl(chainId);
    const bundlerUrl = this.getBundlerUrl(chainId);
    if (!bundlerUrl) {
      throw new Error(`No bundler URL configured for chain ID: ${chainId}`);
    }

    const client = createPublicClient({
      chain: this.getChain(chainId),
      transport: http(rpcUrl),
    });

    return createBundlerClient({
      account,
      client,
      transport: http(bundlerUrl),
      chain: this.getChain(chainId),
    });
  }

  /**
   * Returns the RPC URL for the given chain ID
   *
   * @internal
   * @category URLs
   * @param chainId Target chain ID
   * @returns RPC URL string
   * @throws Error if chain config is missing or URL is invalid
   */
  getRpcUrl(chainId: (typeof SUPPORTED_CHAIN_IDS)[number]): string {
    const chainConfig = this.chainConfigs;
    if (!chainConfig) {
      throw new Error(`No chain config found for chain ID: ${chainId}`);
    }

    if (!this.isValidUrl(chainConfig.rpcUrl)) {
      throw new Error(`Invalid RPC URL for chain ID: ${chainId}`);
    }

    return chainConfig.rpcUrl;
  }

  /**
   * Returns the bundler URL for the given chain ID
   *
   * @internal
   * @category URLs
   * @param chainId Target chain ID
   * @returns Bundler URL string
   * @throws Error if chain config is missing or URL is invalid
   */
  getBundlerUrl(chainId: (typeof SUPPORTED_CHAIN_IDS)[number]): string | undefined {
    const chainConfig = this.chainConfigs;
    if (!chainConfig) {
      throw new Error(`No chain config found for chain ID: ${chainId}`);
    }

    if (!this.isValidUrl(chainConfig.bundlerUrl)) {
      throw new Error(`Invalid bundler URL for chain ID: ${chainId}`);
    }
    return chainConfig.bundlerUrl;
  }

  /**
   * Returns the {@link Chain} object for the given chain ID
   *
   * @internal
   * @category Info
   * @param chainId Target chain ID
   * @returns Chain metadata
   * @throws Error if chain is not found
   */
  getChain(chainId: (typeof SUPPORTED_CHAIN_IDS)[number]): Chain {
    const chain = chainById[chainId];
    if (!chain) {
      throw new Error(`Chain not found for ID: ${chainId}`);
    }
    return chain;
  }

  /**
   * Returns the currently configured supported chain ID
   *
   * @internal
   * @category Info
   * @returns Supported chain ID
   */
  getSupportedChain() {
    return this.chainConfigs.chainId;
  }

  /**
   * Creates a {@link PublicClient} for a chain
   *
   * @internal
   * @category Clients
   * @param chain Chain configuration
   * @returns PublicClient instance
   */
  private createPublicClient(chain: ChainConfig): PublicClient {
    const chainObject = chainById[chain.chainId];

    const client = createPublicClient({
      chain: chainObject,
      transport: http(chain.rpcUrl),
    });

    return client;
  }

  /**
   * Returns the paymaster URL for the given chain ID
   *
   * @internal
   * @category URLs
   * @param chainId Target chain ID
   * @returns Paymaster URL string
   * @throws Error if chain config is missing or URL is invalid
   */
  private getPaymasterUrl(chainId: (typeof SUPPORTED_CHAIN_IDS)[number]): string {
    const chainConfig = this.chainConfigs;
    if (!chainConfig) {
      throw new Error(`No chain config found for chain ID: ${chainId}`);
    }

    if (chainConfig.paymasterUrl && !this.isValidUrl(chainConfig.paymasterUrl)) {
      throw new Error(`Invalid paymaster URL for chain ID: ${chainId}`);
    }
    return chainConfig.paymasterUrl || '';
  }

  /**
   * Creates a {@link PimlicoClient} for the given chain ID
   *
   * @internal
   * @category Clients
   * @param chainId Target chain ID
   * @returns PimlicoClient instance
   * @throws Error if no paymaster URL is configured
   */
  getPaymasterClient(chainId: (typeof SUPPORTED_CHAIN_IDS)[number]): PimlicoClient {
    const paymasterUrl = this.getPaymasterUrl(chainId);
    if (!paymasterUrl) {
      throw new Error(`No paymaster URL configured for chain ID: ${chainId}`);
    }

    const chain = this.getChain(chainId);

    return createPimlicoClient({
      chain,
      transport: http(paymasterUrl),
      entryPoint: {
        address: entryPoint07Address,
        version: '0.7' as EntryPointVersion,
      },
    });
  }
}
