import type { Address } from 'viem';
import type { TransactionData } from '@/types/transaction';

export interface PreparedCalls {
  calls: TransactionData[];
  paymasterContext: {
    token: Address;
  };
}
