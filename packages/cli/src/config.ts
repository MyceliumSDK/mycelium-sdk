import { getEnv } from './utils/formatters';

export const getEnvsConfig = () => {
  return {
    integratorId: getEnv('INTEGRATOR_ID'),
    walletsConfig: {
      embeddedWalletConfig: {
        provider: {
          type: 'privy',
          providerConfig: {
            appId: getEnv('PRIVY_APP_ID'),
            appSecret: getEnv('PRIVY_APP_SECRET'),
          },
        },
      },
      smartWalletConfig: {
        provider: {
          type: 'default',
        },
      },
    },
    chain: {
      chainId: parseInt(getEnv('CHAIN_ID')),
      rpcUrl: getEnv('RPC_URL'),
      bundlerUrl: getEnv('BUNDLER_URL'),
      paymasterUrl: getEnv('PAYMASTER_URL'),
    },
    protocolsSecurityConfig: {
      riskLevel: getEnv('PROTOCOL_RISK_LEVEL'),
    },
    coinbaseCDPConfig: {
      apiKeyId: getEnv('COINBASE_CDP_API_KEY_ID'),
      apiKeySecret: getEnv('COINBASE_CDP_API_KEY_SECRET'),
    },
  };
};
