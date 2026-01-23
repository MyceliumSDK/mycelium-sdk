// Hardcoded ERC20 paymaster address as getTokenQuotes() of permissionless.js library doesn't return a correct paymaster address for 0.7 entry points version
// The address is valid for all chain where the Pimlico paymaster is deployed
export const ERC20_PAYMASTER_ADDRESS = '0x6666666666667849c56f2850848ce1c4da65c68b';

// Percentage of balance to reserve for gas payment for tokens with high decimals (>8)
export const GAS_RESERVE_PERCENTAGE = '1';

// Minimum gas reserve amount in token units for tokens with low decimals (<8)
export const GAS_RESERVE_MINIMUM = '0.01';
