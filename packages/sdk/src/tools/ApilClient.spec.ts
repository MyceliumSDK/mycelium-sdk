import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ApiClient } from '@mycelium/sdk/tools/ApiClient';
import type { ApiResponse } from '@mycelium/sdk/types/api';
import type { VaultInfo } from '@mycelium/sdk/public/types';
import type { Address } from 'viem';
import axios, { type AxiosInstance } from 'axios';

vi.mock('axios');
const mockedAxios = vi.mocked(axios);

describe('ApiClient integration tests', () => {
  let apiClient: ApiClient;
  let mockAxiosInstance: {
    request: ReturnType<typeof vi.fn>;
  };

  const validApiKey = 'sk_' + 'a'.repeat(32); // Valid format: sk_ + 32 hex chars

  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetAllMocks();

    mockAxiosInstance = {
      request: vi.fn(),
    };

    mockedAxios.create.mockReturnValue(mockAxiosInstance as unknown as AxiosInstance);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('constructor', () => {
    it('should create ApiClient with valid API key', () => {
      expect(() => {
        apiClient = new ApiClient(validApiKey);
      }).not.toThrow();
    });

    it('should throw error when API key is missing', () => {
      expect(() => {
        new ApiClient('');
      }).toThrow('Invalid API key format');
    });

    it('should throw error when API key does not start with sk_', () => {
      expect(() => {
        new ApiClient('invalid_key_format');
      }).toThrow('Invalid API key format');
    });

    it('should throw error when API key part is too short', () => {
      expect(() => {
        new ApiClient('sk_' + 'a'.repeat(31)); // 31 chars, needs at least 32
      }).toThrow('Invalid API key format');
    });

    it('should throw error when API key part is too long', () => {
      expect(() => {
        new ApiClient('sk_' + 'a'.repeat(129)); // 129 chars, max is 128
      }).toThrow('Invalid API key format');
    });

    it('should throw error when API key contains non-hex characters', () => {
      expect(() => {
        new ApiClient('sk_' + 'g'.repeat(32)); // 'g' is not hex
      }).toThrow('Invalid API key format');
    });

    it('should accept valid API key with hex characters', () => {
      expect(() => {
        new ApiClient('sk_' + '0123456789abcdefABCDEF'.repeat(2).slice(0, 32));
      }).not.toThrow();
    });
  });

  describe('sendRequest', () => {
    beforeEach(() => {
      apiClient = new ApiClient(validApiKey);
    });

    it('should send GET request for vaults operation', async () => {
      const mockResponse: ApiResponse = {
        success: true,
        data: { stableVaults: [], nonStableVaults: [] },
      };

      mockAxiosInstance.request.mockResolvedValue({
        status: 200,
        data: mockResponse,
      });

      const result = await apiClient.sendRequest('vaults', {
        risk_level: 'medium',
        chain_id: '8453',
        stable_vaults_limit: '1',
        non_stable_vaults_limit: '1',
      });

      expect(mockAxiosInstance.request).toHaveBeenCalledWith({
        method: 'GET',
        url: 'api/v1/public/protocols/best?risk_level=medium&chain_id=8453&stable_vaults_limit=1&non_stable_vaults_limit=1',
        data: undefined,
        headers: {
          Authorization: `Bearer ${validApiKey}`,
          'Content-Type': 'application/json',
        },
      });

      expect(result).toEqual(mockResponse);
    });

    it('should send POST request for deposit operation with protocol ID', async () => {
      const mockVaultInfo: VaultInfo = {
        id: 'vault-1',
        protocolId: 'spark',
        vaultAddress: '0x1111111111111111111111111111111111111111' as Address,
        tokenAddress: '0x2222222222222222222222222222222222222222' as Address,
        tokenDecimals: 6,
        name: 'Test Vault',
        type: 'stable',
        chain: 'base',
      };

      const mockResponse: ApiResponse = {
        success: true,
        data: { to: '0x123', data: '0x456' },
      };

      mockAxiosInstance.request.mockResolvedValue({
        status: 200,
        data: mockResponse,
      });

      const result = await apiClient.sendRequest('deposit', undefined, 'spark', {
        vaultInfo: mockVaultInfo,
        amount: '1000',
        chainId: '8453',
      });

      expect(mockAxiosInstance.request).toHaveBeenCalledWith({
        method: 'POST',
        url: 'api/v1/public/protocols/details/spark/deposit',
        data: {
          vaultInfo: mockVaultInfo,
          amount: '1000',
          chainId: '8453',
        },
        headers: {
          Authorization: `Bearer ${validApiKey}`,
          'Content-Type': 'application/json',
        },
      });

      expect(result).toEqual(mockResponse);
    });

    it('should send POST request for withdraw operation', async () => {
      const mockResponse: ApiResponse = {
        success: true,
        data: { to: '0x123', data: '0x456' },
      };

      mockAxiosInstance.request.mockResolvedValue({
        status: 200,
        data: mockResponse,
      });

      const result = await apiClient.sendRequest('withdraw', undefined, 'spark', {
        vaultInfo: {} as VaultInfo,
        amount: '500',
        chainId: '8453',
      });

      expect(mockAxiosInstance.request).toHaveBeenCalledWith({
        method: 'POST',
        url: 'api/v1/public/protocols/details/spark/withdraw',
        data: {
          vaultInfo: {} as VaultInfo,
          amount: '500',
          chainId: '8453',
        },
        headers: {
          Authorization: `Bearer ${validApiKey}`,
          'Content-Type': 'application/json',
        },
      });

      expect(result).toEqual(mockResponse);
    });

    it('should send POST request for log operation', async () => {
      const mockResponse: ApiResponse = {
        success: true,
        data: { id: 1 },
      };

      mockAxiosInstance.request.mockResolvedValue({
        status: 200,
        data: mockResponse,
      });

      const result = await apiClient.sendRequest('log', undefined, undefined, {
        userAddress: '0x1234567890123456789012345678901234567890' as Address,
        protocolId: 'spark',
        vaultAddress: '0x1111111111111111111111111111111111111111' as Address,
        transactionHash: '0xhash123',
        chainId: '8453',
        amount: '1000',
        status: 'completed',
        operationType: 'deposit',
      });

      expect(mockAxiosInstance.request).toHaveBeenCalledWith({
        method: 'POST',
        url: 'api/v1/public/log/operation',
        data: {
          userAddress: '0x1234567890123456789012345678901234567890',
          protocolId: 'spark',
          vaultAddress: '0x1111111111111111111111111111111111111111',
          transactionHash: '0xhash123',
          chainId: '8453',
          amount: '1000',
          status: 'completed',
          operationType: 'deposit',
        },
        headers: {
          Authorization: `Bearer ${validApiKey}`,
          'Content-Type': 'application/json',
        },
      });

      expect(result).toEqual(mockResponse);
    });

    it('should send GET request for balances with user address', async () => {
      const mockResponse: ApiResponse = {
        success: true,
        data: [],
      };

      mockAxiosInstance.request.mockResolvedValue({
        status: 200,
        data: mockResponse,
      });

      const userAddress = '0x1234567890123456789012345678901234567890' as Address;

      const result = await apiClient.sendRequest('balances', {
        chain_id: '8453',
        protocol_id: 'spark',
        userAddress,
      });

      expect(mockAxiosInstance.request).toHaveBeenCalledWith({
        method: 'GET',
        url: 'api/v1/public/user/0x1234567890123456789012345678901234567890/balances?chain_id=8453&protocol_id=spark',
        data: undefined,
        headers: {
          Authorization: `Bearer ${validApiKey}`,
          'Content-Type': 'application/json',
        },
      });

      expect(result).toEqual(mockResponse);
    });

    it('should send GET request for apiKeyValidation', async () => {
      const mockResponse: ApiResponse = {
        success: true,
        data: { valid: true },
      };

      mockAxiosInstance.request.mockResolvedValue({
        status: 200,
        data: mockResponse,
      });

      const result = await apiClient.sendRequest('apiKeyValidation');

      expect(mockAxiosInstance.request).toHaveBeenCalledWith({
        method: 'GET',
        url: 'api/v1/public/valid',
        data: undefined,
        headers: {
          Authorization: `Bearer ${validApiKey}`,
          'Content-Type': 'application/json',
        },
      });

      expect(result).toEqual(mockResponse);
    });

    it('should send GET request for config', async () => {
      const mockResponse: ApiResponse = {
        success: true,
        data: { config: {} },
      };

      mockAxiosInstance.request.mockResolvedValue({
        status: 200,
        data: mockResponse,
      });

      const result = await apiClient.sendRequest('config');

      expect(mockAxiosInstance.request).toHaveBeenCalledWith({
        method: 'GET',
        url: 'api/v1/public/config',
        data: undefined,
        headers: {
          Authorization: `Bearer ${validApiKey}`,
          'Content-Type': 'application/json',
        },
      });

      expect(result).toEqual(mockResponse);
    });

    it('should handle query parameters correctly', async () => {
      const mockResponse: ApiResponse = {
        success: true,
        data: {},
      };

      mockAxiosInstance.request.mockResolvedValue({
        status: 200,
        data: mockResponse,
      });

      await apiClient.sendRequest('vaults', {
        risk_level: 'high',
        chain_id: '8453',
        stable_vaults_limit: '5',
        non_stable_vaults_limit: '3',
      });

      expect(mockAxiosInstance.request).toHaveBeenCalledWith(
        expect.objectContaining({
          url: expect.stringContaining('risk_level=high'),
        }),
      );
      expect(mockAxiosInstance.request).toHaveBeenCalledWith(
        expect.objectContaining({
          url: expect.stringContaining('chain_id=8453'),
        }),
      );
    });

    it('should throw error when response status is not 200', async () => {
      mockAxiosInstance.request.mockResolvedValue({
        status: 400,
        data: { success: false, error: 'Bad Request' },
      });

      await expect(apiClient.sendRequest('vaults')).rejects.toThrow(
        'Failed to send request to api/v1/public/protocols/best',
      );
    });

    it('should handle API error responses', async () => {
      const mockErrorResponse: ApiResponse = {
        success: false,
        error: 'API error occurred',
      };

      mockAxiosInstance.request.mockResolvedValue({
        status: 200,
        data: mockErrorResponse,
      });

      const result = await apiClient.sendRequest('vaults');

      expect(result).toEqual(mockErrorResponse);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBe('API error occurred');
      }
    });

    it('should handle axios request errors', async () => {
      const error = new Error('Network error');
      mockAxiosInstance.request.mockRejectedValue(error);

      await expect(apiClient.sendRequest('vaults')).rejects.toThrow('Network error');
    });
  });
});
