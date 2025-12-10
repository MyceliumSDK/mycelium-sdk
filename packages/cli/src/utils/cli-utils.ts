export const printAvailableCliOptions = () => {
  console.log('>>>>>> AVAILABLE ACTIONS <<<<<<');
  console.log('1 >> Create account');
  console.log('2 >> Login to account');
  console.log('3 >> Get best vaults');
  console.log('4 >> View wallet details');
  console.log('5 >> Get earning balances');
  console.log('6 >> Top up from faucet');
  console.log('7 >> Deposit to vault');
  console.log('8 >> Withdraw from vault');
  console.log('9 >> Exit');
  console.log('--------------------------------');
};

/**
 * Validates if the input string is a valid number format (integer or decimal)
 * @param amount The amount string to validate
 * @returns True if the format is valid (e.g., "15" or "15.6"), false otherwise
 */
export const isValidAmountFormat = (amount: string): boolean => {
  const trimmed = amount.trim();

  if (!trimmed) {
    return false;
  }

  // Check if it's a valid number format (allows integers and decimals)
  // Pattern: one or more digits, optionally followed by a dot and one or more digits
  const numberPattern = /^\d+(\.\d+)?$/;

  return numberPattern.test(trimmed);
};
