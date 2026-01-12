export type ApiResponse<T = unknown> =
  | {
      success: true;
      data: T;
    }
  | {
      success: false;
      error: string;
    };

export type Method = 'GET' | 'POST';

export interface RequestSettings {
  method: Method;
  path: string;
}

export type OperationType =
  | 'config'
  | 'deposit'
  | 'withdraw'
  | 'log'
  | 'vaults'
  | 'balances'
  | 'apiKeyValidation';

export interface OnchainConfig {
  bundlerUrl: string;
  paymasterUrl?: string;
  coinbaseCdpApiKey: string;
  coinbaseCdpApiKeySecret: string;
  privyAppId: string;
  privyAppSecret: string;
  integratorId: string;
  chainId: number;
  rpcUrl: string;
}
