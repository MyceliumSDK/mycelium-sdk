import type { BaseProtocol } from '@/protocols/base/BaseProtocol';
import type { Vaults } from '@/types/protocols/general';

/**
 * Protocol namespace to manage protocol related operations, e.g. get best vaults
 * @public
 * @category Protocols
 */
export class ProtocolsNamespace {
  private protocol: BaseProtocol;

  constructor(protocol: BaseProtocol) {
    this.protocol = protocol;
  }

  /**
   * Find the best vaults for protocols that were selected based on integrator's settings
   *
   * @returns Best vaults for protocols that were selected based on integrator's settings
   */
  async getBestVaults(
    stableVaultsLimit: number = 1,
    nonStableVaultsLimit: number = 1,
  ): Promise<Vaults> {
    return await this.protocol.getBestVaults(stableVaultsLimit, nonStableVaultsLimit);
  }
}
