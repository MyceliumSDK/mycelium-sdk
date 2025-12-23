import type { SupportedChainId } from '@/constants/chains';
import { availableProtocols } from '@/constants/protocols';
import type { BaseProtocol } from '@/protocols/base/BaseProtocol';
import { ProxyProtocol } from '@/protocols/implementations/ProxyProtocol';
import type { ChainManager } from '@/tools/ChainManager';
import type { Protocol } from '@/types/protocols/general';

/**
 * Protocol Router
 *
 * @internal
 * @category Protocols
 * @remarks
 * Selects and recommends protocols for yield strategies based on router configuration,
 * available protocols, and API key for paid protocols
 */
export class ProtocolRouter {
  /** Chain manager instance for network access */
  private readonly chainManager: ChainManager;

  private readonly isApiKeyValid: boolean;

  /**
   * Initialize the protocol router
   * @param config Router configuration including risk level, min APY, and optional API key
   * @param chainManager Chain manager instance for network validation
   */
  constructor(chainManager: ChainManager, isApiKeyValid: boolean) {
    this.chainManager = chainManager;
    this.isApiKeyValid = isApiKeyValid;
  }

  /**
   * Get all protocols available for the current configuration
   *
   * Includes all non-premium protocols and premium protocols if the API key is valid
   * @returns Array of available protocol definitions
   */
  getActivePublicProtocols(): Protocol[] {
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
    if (this.isApiKeyValid) {
      return new ProxyProtocol();
    }

    const protocols = this.getActivePublicProtocols();

    const eligibleProtocols = protocols.filter((protocol) => {
      const isSupportedChain = this.isProtocolSupportedChain(protocol.info.supportedChains);

      return isSupportedChain;
    });

    if (eligibleProtocols.length === 0) {
      throw new Error(`No protocols available`);
    }

    // For now, we just return the first protocol from public protocols that matches the risk level
    const bestProtocol = eligibleProtocols[0];

    return bestProtocol!.instance;
  }
}
