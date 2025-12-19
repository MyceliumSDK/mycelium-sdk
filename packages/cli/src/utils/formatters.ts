import type { ProxyBalance, VaultInfo } from '@mycelium-sdk/sdk';

export const getEnv = (env: string): string => {
  const value = process.env[env];
  if (!value) {
    throw new Error(`Environment variable ${env} is not set`);
  }
  return value;
};

const formatApy = (apy: number | string | undefined) => {
  if (!apy) {
    return '0%';
  }

  const formattedApy = typeof apy === 'string' ? parseFloat(apy) : apy;
  return (formattedApy * 100).toFixed(2) + '%';
};

const formatTvl = (tvl: number | string | undefined) => {
  if (!tvl) {
    return '$0';
  }

  const formattedTvl = typeof tvl === 'string' ? parseFloat(tvl) : tvl;
  return `$${formattedTvl.toFixed(2)}`;
};

export const formatBalancesToDisplay = (
  balances: {
    optionId?: number | undefined;
    vaultInfo: VaultInfo;
    currentBalance: ProxyBalance | string;
  }[],
) => {
  return balances
    .map(
      (balance) => `
    ${balance.optionId ? `Option ID: ${balance.optionId}` : ''}
    Vault name: ${balance.vaultInfo.id}
    Vault address: ${balance.vaultInfo.vaultAddress}
    Vault chain: ${balance.vaultInfo.chain}
    Vault type: ${balance.vaultInfo.type}
    Current balance: ${balance.currentBalance.currentBalance || balance.currentBalance}
    PNL: ${balance.currentBalance.pnl || 'N/A'}
    Balance in shares: ${balance.currentBalance.balanceInShares || 'N/A'}
    Earned overall: ${balance.currentBalance.earnedOverall || 'N/A'}
    Earned 7d: ${balance.currentBalance.earned7d || 'N/A'}
    Earned 30d: ${balance.currentBalance.earned30d || 'N/A'}
    Earned 90d: ${balance.currentBalance.earned90d || 'N/A'}
    Vault APY: ${formatApy(balance.vaultInfo.metadata?.apy) || 'N/A'}
    Vault TVL: ${formatTvl(balance.vaultInfo.metadata?.poolTvlUsd) || 'N/A'}
  `,
    )
    .join('\n');
};

export const formatVaultInfoToDisplay = (
  vaultsInfo: { optionId?: number; vaultInfo: VaultInfo }[],
) => {
  return vaultsInfo
    .map(
      (vaultInfo) => `
    OPTION: ${vaultInfo.optionId}
    Vault name: ${vaultInfo.vaultInfo.name}
    Vault chain: ${vaultInfo.vaultInfo.chain}
    Vault type: ${vaultInfo.vaultInfo.type}
    Vault APY: ${formatApy(vaultInfo.vaultInfo.metadata?.apy)}
    Vault TVL: ${formatTvl(vaultInfo.vaultInfo.metadata?.poolTvlUsd)}
  `,
    )
    .join('\n');
};
