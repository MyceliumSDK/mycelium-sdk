import type { VaultInfo } from '@/types/protocols/general';

export const SPARK_SSR_ORACLE_ADDRESS = '0x65d946e533748A998B1f0E430803e39A6388f7a1';

export const SPARK_VAULT: VaultInfo[] = [
  {
    id: 'sUSDC',
    protocolId: 'spark',
    name: 'sUSDC',
    type: 'stable',
    chain: 'base',
    vaultAddress: '0x3128a0f7f0ea68e7b7c9b00afa7e41045828e858',
    tokenAddress: '0x833589fcd6edb6e08f4c7c32d4f71b54bda02913',
    tokenDecimals: 6,
    tokenSymbol: 'USDC',
    metadata: {},
  },
];

export const SECONDS_PER_YEAR = 60 * 60 * 24 * 365;
export const RAY = BigInt('1000000000000000000000000000');
