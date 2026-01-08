import { describe, it, expect, vi, beforeEach, afterEach, type Mock } from 'vitest';
import {
  onRampResponseMock,
  coinbaseCDPErrorMock,
  onRampConfigResponseMock,
} from '@mycelium-sdk/core/test/mocks/ramp/on-ramp';
import type { ChainManager } from '@mycelium-sdk/core/tools/ChainManager';
import type { CoinbaseCDP as cdp } from '@mycelium-sdk/core/tools/CoinbaseCDP';
import {
  offRampConfigResponseMock,
  offRampResponseMock,
} from '@mycelium-sdk/core/test/mocks/ramp/off-ramp';

vi.mock('../../utils/urls', () => ({
  checkValidUrl: vi.fn().mockReturnValue(true),
}));

vi.mock('../../utils/chains', () => ({
  chainById: {
    8453: { name: 'base' },
    84532: { name: 'base-sepolia' },
  },
}));

vi.mock('@coinbase/cdp-sdk/auth', () => ({
  generateJwt: vi.fn().mockResolvedValue('test-jwt-token'),
}));

vi.mock('axios', () => {
  const post = vi.fn();
  const get = vi.fn();
  const create = vi.fn(() => ({ post, get }));
  return { default: { create, post, get } };
});

let CoinbaseCDP: typeof cdp;

const getAxiosPostMock = async () => {
  const axios = await import('axios');
  const createMock = axios.default.create as unknown as Mock;
  const instance = createMock.mock.results.at(-1)?.value ?? createMock();
  return instance.post as Mock;
};

const getAxiosGetMock = async () => {
  const axios = await import('axios');
  const createMock = axios.default.create as unknown as Mock;
  const instance = createMock.mock.results.at(-1)?.value ?? createMock();
  return instance.get as Mock;
};

const makeChainManager = (chainId: number = 8453): ChainManager =>
  ({
    getSupportedChain: vi.fn().mockReturnValue(chainId),
    getChain: vi.fn((id: number) => ({ id, name: id === 8453 ? 'base' : 'base-sepolia' })),
  }) as unknown as ChainManager;

describe('CoinbaseCDP (implementation)', () => {
  let chainManager: ChainManager;

  beforeEach(async () => {
    vi.clearAllMocks();
    vi.resetAllMocks();
    vi.resetModules();
    ({ CoinbaseCDP } = await import('@mycelium-sdk/core/tools/CoinbaseCDP'));
    chainManager = makeChainManager(8453);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('auth', () => {
    it('calls generateJwt with correct params and returns token', async () => {
      const { generateJwt } = await import('@coinbase/cdp-sdk/auth');
      const cdp = new CoinbaseCDP(
        'test-api-key-id',
        'test-api-key-secret',
        'test-integrator-id',
        chainManager,
      );

      const token = await cdp.auth({
        requestMethod: 'POST',
        requestHost: 'api.cdp.coinbase.com',
        requestPath: '/platform/v2/onramp/sessions',
        expiresIn: 120,
      });

      expect(generateJwt).toHaveBeenCalledWith(
        expect.objectContaining({
          apiKeyId: 'test-api-key-id',
          apiKeySecret: 'test-api-key-secret',
          requestMethod: 'POST',
          requestHost: 'api.cdp.coinbase.com',
        }),
      );
      expect(token).toBe('test-jwt-token');
    });
  });

  describe('getOnRampLink', () => {
    const addr = '0x1234567890123456789012345678901234567890';
    const redirectUrl = 'https://example.com/success';
    const amount = '100';

    it('returns on-ramp link with default parameters', async () => {
      const post = await getAxiosPostMock();
      post.mockResolvedValueOnce({ status: 200, data: onRampResponseMock });

      const cdp = new CoinbaseCDP('k', 's', 'test-integrator-id', chainManager);
      const res = await cdp.getOnRampLink(addr, redirectUrl, amount);

      expect(res).toEqual(onRampResponseMock);
      expect(res.session?.onrampUrl).toBeDefined();
      expect(res.quote?.destinationNetwork).toBe('base');
    });

    it('passes custom parameters to axios correctly', async () => {
      const post = await getAxiosPostMock();
      post.mockResolvedValueOnce({ status: 200, data: onRampResponseMock });

      const cdp = new CoinbaseCDP('k', 's', 'test-integrator-id', chainManager);
      await cdp.getOnRampLink(addr, redirectUrl, amount, 'USDC', 'USD', 'CARD', 'US');

      expect(post).toHaveBeenCalledWith(
        '/platform/v2/onramp/sessions',
        {
          destinationAddress: addr,
          destinationNetwork: 'base',
          redirectUrl,
          paymentAmount: amount,
          purchaseCurrency: 'USDC',
          paymentCurrency: 'USD',
          paymentMethod: 'CARD',
          country: 'US',
        },
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            Authorization: expect.stringMatching(/^Bearer\s+.+/),
            'Content-Type': 'application/json',
          }),
        }),
      );
    });

    it('returns data for 201', async () => {
      const post = await getAxiosPostMock();
      post.mockResolvedValueOnce({ status: 201, data: onRampResponseMock });

      const cdp = new CoinbaseCDP('k', 's', 'test-integrator-id', chainManager);
      const res = await cdp.getOnRampLink(addr, redirectUrl, amount);
      expect(res).toEqual(onRampResponseMock);
    });

    it('validates redirect url via mocked checkValidUrl (negative case)', async () => {
      const urls = await import('../../utils/urls');
      vi.mocked(urls.checkValidUrl).mockReturnValueOnce(false);

      const cdp = new CoinbaseCDP('k', 's', 'test-integrator-id', chainManager);
      await expect(cdp.getOnRampLink(addr, 'invalid-url', amount)).rejects.toThrow(
        'Redirect URL is not a valid URL',
      );
    });

    it('propagates axios rejections', async () => {
      const post = await getAxiosPostMock();
      post.mockRejectedValueOnce(new Error('Network error'));

      const cdp = new CoinbaseCDP('k', 's', 'test-integrator-id', chainManager);
      await expect(cdp.getOnRampLink(addr, redirectUrl, amount)).rejects.toThrow('Network error');
    });

    it('throws when API responds with non-200/201', async () => {
      const post = await getAxiosPostMock();
      post.mockResolvedValueOnce({ status: 400, data: coinbaseCDPErrorMock });

      const cdp = new CoinbaseCDP('k', 's', 'test-integrator-id', chainManager);
      await expect(cdp.getOnRampLink(addr, redirectUrl, amount)).rejects.toThrow();
    });
  });

  describe('getOffRampLink', () => {
    const addr = '0x1234567890123456789012345678901234567890';
    const redirectUrl = 'https://example.com/success';
    const country = 'US';
    const paymentMethod = 'FIAT_WALLET';
    const sellAmount = '100';
    const cashoutCurrency = 'USD';
    const sellCurrency = 'USDC';

    it('returns off-ramp link with default parameters', async () => {
      const post = await getAxiosPostMock();
      post.mockResolvedValueOnce({ status: 200, data: offRampResponseMock });

      const cdp = new CoinbaseCDP('k', 's', 'test-integrator-id', chainManager);
      const res = await cdp.getOffRampLink(
        addr,
        country,
        paymentMethod,
        redirectUrl,
        sellAmount,
        cashoutCurrency,
        sellCurrency,
      );

      expect(res).toEqual(offRampResponseMock);
      expect(res.offramp_url).toBeDefined();
      expect(res.quote_id).toBeDefined();
      expect(res.cashout_total).toBeDefined();
      expect(res.cashout_subtotal).toBeDefined();
      expect(res.sell_amount).toBeDefined();
      expect(res.coinbase_fee).toBeDefined();
    });

    it('passes custom parameters to axios correctly', async () => {
      const post = await getAxiosPostMock();
      post.mockResolvedValueOnce({ status: 200, data: offRampResponseMock });

      const cdp = new CoinbaseCDP('k', 's', 'test-integrator-id', chainManager);
      await cdp.getOffRampLink(
        addr,
        country,
        paymentMethod,
        redirectUrl,
        sellAmount,
        cashoutCurrency,
        sellCurrency,
      );

      expect(post).toHaveBeenCalledWith(
        '/onramp/v1/sell/quote',
        {
          sourceAddress: addr,
          country,
          paymentMethod,
          partnerUserId: 'test-integrator-id',
          redirectUrl,
          sellAmount,
          sellNetwork: 'base',
          cashoutCurrency,
          sellCurrency,
        },
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            Authorization: expect.stringMatching(/^Bearer\s+.+/),
            'Content-Type': 'application/json',
          }),
        }),
      );
    });

    it('returns data for 201', async () => {
      const post = await getAxiosPostMock();
      post.mockResolvedValueOnce({ status: 201, data: offRampResponseMock });

      const cdp = new CoinbaseCDP('k', 's', 'test-integrator-id', chainManager);
      const res = await cdp.getOffRampLink(
        addr,
        country,
        paymentMethod,
        redirectUrl,
        sellAmount,
        cashoutCurrency,
        sellCurrency,
      );
      expect(res).toEqual(offRampResponseMock);
    });

    it('validates redirect url via mocked checkValidUrl (negative case)', async () => {
      const urls = await import('../../utils/urls');
      vi.mocked(urls.checkValidUrl).mockReturnValueOnce(false);

      const cdp = new CoinbaseCDP('k', 's', 'test-integrator-id', chainManager);
      await expect(
        cdp.getOffRampLink(
          addr,
          country,
          paymentMethod,
          'invalid-url',
          sellAmount,
          cashoutCurrency,
          sellCurrency,
        ),
      ).rejects.toThrow('Redirect URL is not a valid URL');
    });

    it('propagates axios rejections', async () => {
      const post = await getAxiosPostMock();
      post.mockRejectedValueOnce(new Error('Network error'));

      const cdp = new CoinbaseCDP('k', 's', 'test-integrator-id', chainManager);
      await expect(
        cdp.getOffRampLink(
          addr,
          country,
          paymentMethod,
          redirectUrl,
          sellAmount,
          cashoutCurrency,
          sellCurrency,
        ),
      ).rejects.toThrow('Network error');
    });

    it('throws when API responds with non-200/201', async () => {
      const post = await getAxiosPostMock();
      post.mockResolvedValueOnce({ status: 400, data: coinbaseCDPErrorMock });

      const cdp = new CoinbaseCDP('k', 's', 'test-integrator-id', chainManager);
      await expect(
        cdp.getOffRampLink(
          addr,
          country,
          paymentMethod,
          redirectUrl,
          sellAmount,
          cashoutCurrency,
          sellCurrency,
        ),
      ).rejects.toThrow();
    });
  });

  describe('getOffRampConfig', () => {
    it('returns off-ramp config', async () => {
      const get = await getAxiosGetMock();
      get.mockResolvedValueOnce({ status: 200, data: offRampConfigResponseMock });

      const cdp = new CoinbaseCDP('k', 's', 'test-integrator-id', chainManager);
      const res = await cdp.getOffRampConfig();
      expect(res).toEqual(offRampConfigResponseMock);
    });
  });

  describe('getOnRampConfig', () => {
    it('returns on-ramp config', async () => {
      const get = await getAxiosGetMock();
      get.mockResolvedValueOnce({ status: 200, data: onRampConfigResponseMock });

      const cdp = new CoinbaseCDP('k', 's', 'test-integrator-id', chainManager);
      const res = await cdp.getOnRampConfig();
      expect(res).toEqual(onRampConfigResponseMock);
    });
  });
});
