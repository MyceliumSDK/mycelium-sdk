import type { SupportedChainId } from '@/constants/chains';
import type { ChainManager } from '@/tools/ChainManager';
import { ApiKeysValidator } from '@/tools/ApiKeysValidator';
import type { ProtocolsRouterConfig } from '@/types/protocols/general';
import type { BaseProtocol } from '@/protocols/base/BaseProtocol';

/**
 * Base Protocol Router
 *
 * @internal
 * @abstract
 * @category Protocols
 * @remarks
 * Abstract base class for protocol router implementations such as Spark, Beefy, Aave, Morpho, etc
 * Provides a standard interface for selecting protocols based on configuration parameters
 */
export abstract class ProtocolRouterBase {
  /** Required risk level specified by the integrator */
  public readonly riskLevel: ProtocolsRouterConfig['riskLevel'];

  /** Minimum APY required by the integrator */
  public readonly minApy?: ProtocolsRouterConfig['minApy'];

  /** API key to access premium protocols with higher yields */
  public readonly apiKey?: string; // TODO: Add an API key validation

  /** API key validator instance */
  public readonly apiKeyValidator: ApiKeysValidator = new ApiKeysValidator();

  /** Chain manager instance for network access */
  public readonly chainManager: ChainManager;

  /**
   * Initialize a base protocol router
   * @param riskLevel Risk level required by the integrator
   * @param chainManager Chain manager instance for network operations
   * @param minApy Optional minimum APY filter
   * @param apiKey Optional API key for premium protocol access
   */
  constructor(
    riskLevel: ProtocolsRouterConfig['riskLevel'],
    chainManager: ChainManager,
    minApy?: ProtocolsRouterConfig['minApy'],
    apiKey?: ProtocolsRouterConfig['apiKey'],
  ) {
    this.riskLevel = riskLevel;
    this.minApy = minApy;
    this.apiKey = apiKey;
    this.chainManager = chainManager;
  }

  /**
   * Check if the given chains are supported by the router
   * @param chainIds List of chain IDs to check
   * @returns True if at least one chain is supported
   */
  abstract isProtocolSupportedChain(chainIds: SupportedChainId[]): boolean;

  /**
   * Recommend the most suitable protocol based on router configuration
   * @remarks Returns a protocol that best matches the configured risk level, APY, and chain support
   * @returns Protocol instance considered the best match
   */
  abstract select(): BaseProtocol;
}
