import type { VaultInfo } from '@/types/protocols/general';
import type { Hex } from '@privy-io/server-auth';
import type { Address, Hash } from 'viem';

export interface ProxyVaults {
  stableVaults: VaultInfo[];
  nonStableVaults: VaultInfo[];
}

export interface ProxyVaultsResponse {
  success: boolean;
  data: ProxyVaults;
}

export interface OperationCallDataType {
  to: Address;
  data: Hex;
}

export interface LogOperationDataResponse {
  id: number;
  type: 'deposit' | 'withdraw';
  protocolId: string;
  integratorId: string;
  userAddress: Address;
  vaultAddress: Address;
  chainId: number;
  amount: string;
  transactionHash: Hash;
  status: 'completed' | 'failed';
  createdAt: string;
}

export interface ProxyBalance {
  userAddress: Address;
  integratorId: string;
  protocolId: string;
  vaultAddress: Address;
  chainId: number;
  currentBalance: string;
  earnedOverall: string;
  earned7d: string;
  earned30d: string;
  earned90d: string;
  earnedOverallUpdatedAt: string | null;
  earned7dUpdatedAt: string | null;
  earned30dUpdatedAt: string | null;
  earned90dUpdatedAt: string | null;
}
