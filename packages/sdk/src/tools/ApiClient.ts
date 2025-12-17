import { BACKEND_HOSTNAME } from '@/constants/general';
import type { VaultInfo } from '@/public/types';
import type { ApiResponse, OperationType, RequestSettings } from '@/types/api';
import axios, { type AxiosInstance, type AxiosResponse } from 'axios';

export class ApiClient {
  private readonly client: AxiosInstance = axios.create({
    baseURL: BACKEND_HOSTNAME,
  });

  /** URL settings for the endpoint: get the best vaults to deposit funds */
  private readonly bestVaultUrlSettings: RequestSettings = {
    method: 'GET',
    path: 'api/v1/public/protocols/best',
  };

  /** URL settings for the endpoint: deposit funds to a provided vault */
  private readonly depositUrlSettings: RequestSettings = {
    method: 'POST',
    path: 'api/v1/public/protocols/details/:protocolId/deposit',
  };

  /** URL settings for the endpoint: log a vault-related operation after deposit or withdraw funds */
  private readonly logOperationSettings: RequestSettings = {
    method: 'POST',
    path: 'api/v1/public/log/operation',
  };

  /** URL settings for the endpoint: withdraw funds from a provided vault */
  private readonly withdrawUrlSettings: RequestSettings = {
    method: 'POST',
    path: 'api/v1/public/protocols/details/:protocolId/withdraw',
  };

  /** URL settings for the endpoint: get the balances of a user by a provided address */
  private readonly balancesUrlSettings: RequestSettings = {
    method: 'GET',
    path: 'api/v1/public/user/:userAddress/balances',
  };

  /** URL settings for the endpoint: validate the API key */
  private readonly apiKeyValidUrlSettings: RequestSettings = {
    method: 'GET',
    path: 'api/v1/public/valid',
  };

  /** URL settings for the endpoint: get the config for services */
  private readonly configUrlSettings: RequestSettings = {
    method: 'GET',
    path: 'api/v1/public/config',
  };

  /** URL settings mapping with operation types */
  private readonly operationTypeToUrlSettings: Record<OperationType, RequestSettings> = {
    deposit: this.depositUrlSettings,
    withdraw: this.withdrawUrlSettings,
    log: this.logOperationSettings,
    vaults: this.bestVaultUrlSettings,
    balances: this.balancesUrlSettings,
    apiKeyValidation: this.apiKeyValidUrlSettings,
    config: this.configUrlSettings,
  };

  /** API key for the backend API */
  private apiKey: string;

  constructor(apiKey: string) {
    this.apiKey = apiKey;

    if (!this.validateApiKeyFormat()) {
      throw new Error('Invalid API key format');
    }
  }

  /**
   * Send a request to the backend API
   * @param path Path of the endpoint to send the request to
   * @param method Method of the request
   * @param body Body of the request
   * @returns Response from the backend API
   */
  async sendRequest(
    operationType: OperationType,
    params?: Record<string, string>,
    protocolId?: string,
    body?: Record<string, string | VaultInfo>,
  ): Promise<ApiResponse<unknown>> {
    const { path, method } = this.operationTypeToUrlSettings[operationType];

    let requestPath = path;
    // TODO: Make processing of params in a request more clear
    if (protocolId) {
      requestPath = requestPath.replace(':protocolId', protocolId);
    }
    if (params?.userAddress) {
      requestPath = requestPath.replace(':userAddress', params.userAddress);
      delete params.userAddress; // Remove from query params since it's in the path
    }

    const urlParams = new URLSearchParams(params).toString();

    if (urlParams) {
      requestPath += `?${urlParams}`;
    }

    const response: AxiosResponse<ApiResponse<unknown>> = await this.client.request({
      method,
      url: requestPath,
      data: body,
      headers: { Authorization: `Bearer ${this.apiKey}`, 'Content-Type': 'application/json' },
    });

    if (response.status !== 200) {
      throw new Error(`Failed to send request to ${path}`);
    }

    const apiResponse = response.data as ApiResponse<unknown>;

    return apiResponse;
  }

  /**
   * Validates whether the provided API key is valid
   *
   * @internal
   * @param apiKey API key from {@link ProtocolsRouterConfig}
   * @returns True if the API key is considered valid
   */
  async validate() {
    if (!this.validateApiKeyFormat()) {
      throw new Error('Invalid API key format');
    }

    const apiResponse = await this.sendRequest('apiKeyValidation');

    if (!apiResponse.success) {
      throw new Error(apiResponse.error || 'Failed to validate API key');
    }

    return true;
  }

  /**
   *
   * Validates the format of the API key. Must start with 'sk_' and contain only hexadecimal characters
   *
   * @internal
   * @param apiKey API key from {@link ProtocolsRouterConfig}
   * @returns
   */
  private validateApiKeyFormat() {
    if (!this.apiKey) {
      return false;
    }

    const prefix = 'sk_';
    if (!this.apiKey.startsWith(prefix)) {
      return false;
    }

    const keyPart = this.apiKey.slice(prefix.length);

    if (keyPart.length < 32 || keyPart.length > 128) {
      return false;
    }

    const hexPattern = /^[0-9a-fA-F]+$/;
    if (!hexPattern.test(keyPart)) {
      return false;
    }

    return true;
  }
}
