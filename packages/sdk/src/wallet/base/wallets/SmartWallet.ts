import type { Address, Hash, LocalAccount } from 'viem';

import type { SupportedChainId } from '@/constants/chains';
import type { TokenBalance } from '@/types/token';
import type { AssetIdentifier } from '@/utils/assets';
import type { TransactionData } from '@/types/transaction';
import type { VaultBalance, VaultInfo, VaultTxnResult } from '@/types/protocols/general';
import type { OffRampUrlResponse, OnRampUrlResponse } from '@/types/ramp';

/**
 * Abstract base class for smart wallet implementations
 *
 * @internal
 * @category Wallets
 * @remarks
 * Provides the interface for ERC-4337 compatible wallets
 * Extended by concrete classes such as {@link DefaultSmartWallet}
 */
export abstract class SmartWallet {
  /** LocalAccount used for signing transactions on behalf of this smart wallet */
  abstract signer: LocalAccount;

  /**
   * Returns the deployed or predicted address of this smart wallet
   *
   * @internal
   * @category Addressing
   * @remarks
   * For undeployed wallets this returns the deterministic CREATE2 address
   *
   * @returns Promise resolving to the wallet Ethereum address
   */
  abstract getAddress(): Promise<Address>;

  /**
   * Retrieves balances for all supported tokens held by this smart wallet
   *
   * @internal
   * @category Balances
   * @returns Promise resolving to an array of {@link TokenBalance} entries
   */
  abstract getBalance(): Promise<TokenBalance[]>;

  // TODO: add addSigner method
  // TODO: add removeSigner method

  /**
   * Executes a transaction through the smart wallet
   *
   * @internal
   * @category Transactions
   * @remarks
   * Handles gas sponsorship and ERC-4337 UserOperation creation automatically
   *
   * @param transactionData Transaction data to execute
   * @param chainId Target blockchain chain ID
   * @param options Optional parameters
   * @param options.paymasterToken ERC-20 token address to use for gas payment (e.g., USDC)
   * @returns Promise resolving to the transaction {@link Hash}
   */
  abstract send(
    transactionData: TransactionData,
    chainId: SupportedChainId,
    options?: {
      paymasterToken?: Address;
    },
  ): Promise<Hash>;

  /**
   * Executes a batch of transactions through the smart wallet
   *
   * @internal
   * @category Transactions
   * @remarks
   * Transactions are executed in the order they are provided
   * Handles gas sponsorship and ERC-4337 UserOperation creation automatically
   *
   * @param transactionData Array of transaction data objects
   * @param chainId Target blockchain chain ID
   * @param options Optional parameters
   * @param options.paymasterToken ERC-20 token address to use for gas payment (e.g., USDC)
   * @returns Promise resolving to the transaction {@link Hash}
   */
  abstract sendBatch(
    transactionData: TransactionData[],
    chainId: SupportedChainId,
    options?: {
      paymasterToken?: Address;
    },
  ): Promise<Hash>;

  /**
   * Prepares transaction data for sending tokens to another address
   *
   * @internal
   * @category Transactions
   * @param amount Human-readable amount to send
   * @param asset Token or asset identifier
   * @param recipientAddress Destination address
   * @returns Promise resolving to prepared {@link TransactionData}
   */
  abstract sendTokens(
    amount: number,
    asset: AssetIdentifier,
    recipientAddress: Address,
  ): Promise<TransactionData>;

  /**
   * Deposits funds into a selected protocol vault to start earning yield
   *
   * @internal
   * @category Yield
   * @param amount Amount to deposit in human-readable format
   * @param options Optional parameters
   * @param options.paymasterToken ERC-20 token address to use for gas payment (e.g., USDC)
   * @returns Promise resolving to a {@link VaultTxnResult}
   */
  abstract earn(
    vaultInfo: VaultInfo,
    amount: string,
    options?: { paymasterToken?: Address },
  ): Promise<VaultTxnResult>;

  /**
   * Retrieves the balance of deposited funds in the selected protocol vault
   *
   * @internal
   * @category Yield
   * @returns Promise resolving to a {@link VaultBalance} or null if none
   */
  abstract getEarnBalances(): Promise<VaultBalance[] | null>;

  /**
   * Withdraws a specific amount of shares from the protocol vault
   *
   * @internal
   * @category Yield
   * @param amount Human-readable amount of shares to withdraw
   * @param options Optional parameters
   * @param options.paymasterToken ERC-20 token address to use for gas payment (e.g., USDC)
   * @returns Promise resolving to a {@link VaultTxnResult}
   */
  abstract withdraw(
    vaultInfo: VaultInfo,
    amount: string,
    options?: { paymasterToken?: Address },
  ): Promise<VaultTxnResult>;

  /**
   * Funds the smart wallet with the specified amount of the specified token via Coinbase CDP on-ramp service
   *
   * @internal
   * @category Ramp
   *
   * @remarks
   * If Coinbase CDP is not initialized, the method will throw an error
   *
   * @param amount Amount of token that a user wants to purchase and top up his account with (e.g., `"100"`, `"1.5"`)
   * @param redirectUrl URL to redirect to after the on-ramp is complete. It's required to be a valid URL
   * @param purchaseCurrency Purchase currency (e.g., `"USDC"`, `"ETH"`). To get the ful list, visit ""
   * @param paymentCurrency Payment currency (e.g., `"USD"`, `"EUR"`). To get the ful list, visit ""
   * @param paymentMethod Payment method (e.g., `"CARD"`). To get the ful list, visit ""
   * @param chain Chain name (e.g., `"base"`)
   * @param country Country code (e.g., `"US"`)
   *
   *
   * @returns A URL string to the on-ramp service
   */
  abstract topUp(
    amount: string,
    redirectUrl: string,
    purchaseCurrency?: string,
    paymentCurrency?: string,
    paymentMethod?: string,
    country?: string,
  ): Promise<OnRampUrlResponse>;

  /**
   * @internal
   * Cash out funds from the smart wallet to a specified currency via Coinbase CDP off-ramp service
   * @category Ramp
   *
   * @param country
   * @param paymentMethod
   * @param redirectUrl
   * @param sellAmount
   * @param cashoutCurrency
   * @param sellCurrency
   * @returns A URL string to the off-ramp service
   *
   */
  abstract cashOut(
    country: string,
    paymentMethod: string,
    redirectUrl: string,
    sellAmount: string,
    cashoutCurrency?: string,
    sellCurrency?: string,
  ): Promise<OffRampUrlResponse>;
}
