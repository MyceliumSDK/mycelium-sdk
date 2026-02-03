---
'@mycelium-sdk/core': major
---

## What was changed?

- Introduced AddressBalance: balance is now returned as:{ overall: OverallAddressBalance; perVault: VaultBalance[] } instead of VaultBalance[]
- getBalances() (SparkProtocol, ProxyProtocol) now returns AddressBalance (overall totals plus per-vault list)
- getEarnBalances() on the wallet now returns AddressBalance instead of VaultBalance[]
- AddressBalance is exported from the SDK public types

## Why was changed/added?

- Mycelium Cloud started to return a different format of data for the balance
- Callers need both an aggregated view (overall balance) and per-vault breakdown; a single type with overall and perVault supports both without extra requests
- Aligns protocol and wallet APIs and keeps balance shape consistent across the SDK

## How to use the change?

Use the new return type: result.overall for aggregated numbers, result.perVault for the list of vault balances (same structure as before, but under perVault). Example: const { overall, perVault } = await wallet.getEarnBalances(); and then use perVault[0].balance, perVault[0].vaultInfo, etc. Replace any code that treated the result as a plain array (e.g. result[0]) with result.perVault[0] and use result.overall when you need totals
