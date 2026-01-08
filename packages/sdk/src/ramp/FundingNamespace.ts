import type { CoinbaseCDP } from '@/tools/CoinbaseCDP';
import type { RampConfigResponse } from '@/types/ramp';

/**
 * Namespace to manage funding & payouts of an account
 * @public
 * @remarks
 * Contains 2 methods to get available options to top up an account and cash out funds
 * - {@link getTopUpConfig} to get available options to top up an account
 * - {@link getCashOutConfig} to get available options to cash out funds
 *
 * @example
 * ```ts
 * const topUpConfig = await myceliumSDK.funding.getTopUpConfig();
 * const cashOutConfig = await myceliumSDK.funding.getCashOutConfig();
 * ```
 * @category 4. Funding & payouts
 */
export class FundingNamespace {
  private readonly coinbaseCDP: CoinbaseCDP | null = null;

  constructor(coinbaseCDP: CoinbaseCDP) {
    if (!coinbaseCDP) {
      throw new Error(
        'Coinbase CDP is not initialized. Please, provide the configuration in the SDK initialization',
      );
    }

    this.coinbaseCDP = coinbaseCDP;
  }

  /**
   * Return all supported countries and payment methods for on-ramp by Coinbase CDP
   * @public
   * @category Funding
   *
   * @returns @see {@link RampConfigResponse} with supported countries and payment methods for top-up
   * @throws If API returned an error
   */
  async getTopUpConfig(): Promise<RampConfigResponse> {
    return await this.coinbaseCDP!.getOnRampConfig();
  }

  /**
   * Return all supported countries and payment methods for off-ramp by Coinbase CDP
   * @public
   * @category Funding
   *
   *
   * @returns @see {@link RampConfigResponse} with supported countries and payment methods for cash out
   * @throws If API returned an error
   */
  async getCashOutConfig(): Promise<RampConfigResponse> {
    return await this.coinbaseCDP!.getOffRampConfig();
  }
}
