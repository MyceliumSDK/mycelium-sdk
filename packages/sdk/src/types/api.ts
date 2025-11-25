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
  | 'deposit'
  | 'withdraw'
  | 'log'
  | 'vaults'
  | 'balances'
  | 'apiKeyValidation';
