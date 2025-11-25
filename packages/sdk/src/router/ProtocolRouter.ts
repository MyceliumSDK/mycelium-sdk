import type { SupportedChainId } from '@/constants/chains';
import { availableProtocols } from '@/constants/protocols';
import type { BaseProtocol } from '@/protocols/base/BaseProtocol';
import { ProxyProtocol } from '@/protocols/implementations/ProxyProtocol';
import { ProtocolRouterBase } from '@/router/base/ProtocolRouterBase';
import type { ChainManager } from '@/tools/ChainManager';
import type { Protocol, ProtocolsRouterConfig } from '@/types/protocols/general';

/**
 * Protocol Router
 *
 * @internal
 * @category Protocols
 * @remarks
 * Selects and recommends protocols for yield strategies based on router configuration,
 * available protocols, and API key for paid protocols
 */
export class ProtocolRouter extends ProtocolRouterBase {
  private isPremiumAvailable: boolean;

  /**
   * Initialize the protocol router
   * @param config Router configuration including risk level, min APY, and optional API key
   * @param chainManager Chain manager instance for network validation
   */
  constructor(config: ProtocolsRouterConfig, chainManager: ChainManager) {
    super(config.riskLevel, chainManager, config.minApy, config.apiKey);

    this.isPremiumAvailable = this.apiKeyValidator.validate(this.apiKey);
  }
  /**
   * Get all protocols available for the current configuration
   *
   * Includes all non-premium protocols and premium protocols if the API key is valid
   * @returns Array of available protocol definitions
   */
  getActivePublicProtocols(): Protocol[] {
    // Include all publicly available protocols
    const allAvailableProtocols = availableProtocols.filter((protocol) => {
      return protocol.info.isActive;
    });

    return allAvailableProtocols;
  }

  /**
   * Check if any protocol supports a given set of chains
   * @param chainIds List of chain IDs to validate
   * @returns True if at least one chain is supported by the router
   */
  isProtocolSupportedChain(chainIds: SupportedChainId[]): boolean {
    return chainIds.some((chainId) => this.chainManager.getSupportedChain() === chainId);
  }

  /**
   * Recommend the best protocol for the current router configuration
   *
   * Filters available protocols by risk level and supported chains. More criteria will be added later on
   *
   *
   * @remarks
   * Currently returns the first match. Future improvements will add
   * smarter sorting and pool-based APY checks
   *
   * @throws Error if no protocols are available for the current risk level
   * @returns Protocol instance considered the best match
   */
  select(): BaseProtocol {
    if (this.isPremiumAvailable) {
      return new ProxyProtocol();
    }

    const protocols = this.getActivePublicProtocols();

    // Filter protocols that match the risk level. Later on add more conditions for the recommendation
    const eligibleProtocols = protocols.filter((protocol) => {
      // Check if protocol matches risk level
      const riskMatches = protocol.info.riskLevel === this.riskLevel;

      const isSupportedChain = this.isProtocolSupportedChain(protocol.info.supportedChains);

      return riskMatches && isSupportedChain;
    });

    if (eligibleProtocols.length === 0) {
      throw new Error(`No protocols available for risk level: ${this.riskLevel}`);
    }

    // For now, we just return the first protocol from public protocols that matches the risk level
    const bestProtocol = eligibleProtocols[0];

    return bestProtocol!.instance;
  }
}
