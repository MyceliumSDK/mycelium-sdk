import { SparkProtocol } from '@/protocols/implementations/SparkProtocol';
import type { Protocol } from '@/types/protocols/general';

/**
 * Current config of protocols should have correct supportedChains array as it used to:
 * 1. Fetch vaults per chain to find the best vault for the protocol
 * 2. Deposit funds of users to a best found vault
 */
export const availableProtocols: Protocol[] = [
  {
    info: {
      id: 'spark',
      name: 'Spark',
      website: 'https://spark.fi/',
      logo: '/logos/spark.png',
      supportedChains: [8453],
      riskLevel: 'low',
      isActive: false,
    },
    instance: new SparkProtocol(),
  },
];
