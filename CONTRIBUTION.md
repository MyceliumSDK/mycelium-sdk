# Contributing to Mycelium SDK

Thank you for your interest in contributing to the Mycelium SDK! This document provides guidelines and information for contributors

## Table of contents

- [Code of conduct](#code-of-conduct)
- [Getting started](#getting-started)
- [Development workflow](#development-workflow)
- [Code standards](#code-standards)
- [Testing guidelines](#testing-guidelines)
- [Documentation](#documentation)
- [Pull request process](#pull-request-process)
- [Issue reporting](#issue-reporting)
- [License](#license)

## Code of conduct

This project follows a code of conduct that we expect all contributors to adhere to:

- Be respectful and inclusive
- Focus on constructive feedback
- Help maintain a welcoming environment
- Respect different viewpoints and experiences

## Getting started

### Prerequisites

Before contributing, ensure you have:

- **pnpm** >= 10.9.0
- **Node.js** >= 22.11.0
- **TypeScript** >= 5.0.0
- **Git** with proper configuration
- **Anvil** >= 1.2.3 (for blockchain package development)

### Initial setup

1. **Fork the repository** on GitHub
2. **Clone your fork** locally:

   ```bash
   git clone https://github.com/your-username/mycelium-sdk.git
   cd mycelium-sdk
   ```

3. **Install dependencies**:

   ```bash
   pnpm install
   ```

4. **Set up environment variables**:

   ```bash
   # Copy example files
   cp packages/frontend/.env.example packages/frontend/.env
   cp packages/blockchain/.env.example packages/blockchain/.env

   # Configure your environment variables
   ```

5. **Verify setup**:
   ```bash
   pnpm run build
   pnpm run test
   ```

## Development workflow

### Branch strategy

- **Main branch**: `main` - production-ready code
- **Feature branches**: `feature/description` - new features
- **Bug fixes**: `fix/description` - bug fixes
- **Documentation**: `docs/description` - documentation updates

### Creating a feature branch

```bash
# Ensure you're on main and up to date
git checkout main
git pull origin main

# Create and switch to your feature branch
git checkout -b feature/your-feature-name

# Example naming conventions:
git checkout -b feature/add-spark-protocol
git checkout -b fix/wallet-balance-calculation
git checkout -b docs/api-reference-update
```

### Development commands

**Build all packages:**

```bash
pnpm run build
```

**Run development servers:**

```bash
pnpm run dev
```

**Run tests:**

```bash
pnpm run test
```

**Run linting:**

```bash
pnpm run lint
```

**Format code:**

```bash
pnpm run format:fix
```

**Spell check:**

```bash
pnpm run spell
```

## Code standards

### TypeScript guidelines

- Use **strict TypeScript** configuration
- Prefer `type` imports: `import type { ... } from '...'`
- Don't import with file extension
- Use aliases for imports
- Each new functionalities should be covered by unit tests
- Avoid `any` type - use proper typing or `unknown`
- Use meaningful variable and function names
- Add JSDoc comments for public APIs (check examples in other classes)

**Example:**

```typescript
import type { ChainManager } from '@/tools/ChainManager';

/**
 * @internal
 *
 * Creates a new wallet instance
 * @remarks
 * The method to create a embedded wallet class using a provider...
 * @param userId - Unique user identifier
 * @param chainManager - Chain manager instance
 * @returns Promise resolving to wallet instance
 */
export async function createWallet(userId: string, chainManager: ChainManager): Promise<Wallet> {
  // Implementation
}
```

### File organization

- Use **kebab-case** for file names: `wallet-provider.ts`
- Use **PascalCase** for class names: `WalletProvider`
- Use **camelCase** for functions and variables: `createWallet`
- Group related functionality in appropriate directories

### Import/export standards

```typescript
// Preferred: imports with an alias
import type { WalletConfig } from '@/types/wallet';

// Avoid: imports with absolute imports
export { WalletProvider } from './WalletProvider';
export type { WalletConfig } from './types';

// Avoid: default exports for classes
// Good
export class WalletProvider {}

// Avoid
export default class WalletProvider {}
```

### Error handling

- Use descriptive error messages
- Include context in error objects
- Handle errors gracefully with proper fallbacks

```typescript
try {
  const result = await riskyOperation();
  return result;
} catch (error) {
  logger.error('Failed to execute operation', { error, context });
  throw new Error(`Operation failed: ${error.message}`);
}
```

## Testing guidelines

### Test structure

- Write tests for all public APIs
- Include both unit and integration tests
- Use descriptive test names
- Follow AAA pattern: Arrange, Act, Assert

**Example:**

```typescript
describe('WalletProvider', () => {
  describe('createWallet', () => {
    it('should create wallet with valid user ID', async () => {
      // Arrange
      const userId = 'test-user-123';
      const mockChainManager = createMockChainManager();

      // Act
      const wallet = await walletProvider.createWallet(userId, mockChainManager);

      // Assert
      expect(wallet).toBeDefined();
      expect(wallet.userId).toBe(userId);
    });
  });
});
```

### Running tests

**All tests:**

```bash
pnpm run test
```

**Watch mode:**

```bash
cd packages/sdk
pnpm run test:watch
```

**Specific package tests:**

```bash
cd packages/sdk
pnpm run test
```

### Test coverage

- Maintain high test coverage for critical functionality
- Focus on testing business logic and edge cases
- Mock external dependencies appropriately

## Documentation

### Code documentation

- Add JSDoc comments for all public APIs
- Include parameter descriptions and return types
- Provide usage examples where helpful
- Use typedoc tags to generate a proper documentation:
  - `@internal` to include the class/method description to a dev documentation
  - `@public` to include the class/method description to a public documentation

```typescript
/**
   * Deposits into the selected protocol’s vault
   *
   * @internal
   * @category Protocol
   * @param amount Human-readable amount string
   * @returns Transaction result for the deposit
   */
  async earn(amount: string): Promise<VaultTxnResult> {
   // Implementation
  }
```

### README updates

- Update relevant README files when adding features
- Include setup instructions for new dependencies
- Document any breaking changes

### API documentation

Generate documentation:

```bash
cd packages/sdk
# Public doc
pnpm run docs:public
# Dev doc
pnpm run docs:public
```

## Pull request process

### Before submitting

1. **Ensure your code builds**:

   ```bash
   pnpm run build
   ```

2. **Run all tests**:

   ```bash
   pnpm run test
   ```

3. **Check linting**:

   ```bash
   pnpm run lint
   ```

4. **Format code**:

   ```bash
   pnpm run format:fix
   ```

5. **Spell check**:
   ```bash
   pnpm run spell
   ```

### Pull request guidelines

1. **Clear title**: Use descriptive titles that explain the change
2. **Detailed description**: Explain what changed and why
3. **Link issues**: Reference related issues using `Fixes #123` or `Closes #123`
4. **Screenshots**: Include screenshots for UI changes
5. **Breaking changes**: Clearly mark any breaking changes

**Example PR description:**

```markdown
## Description

Adds support for Spark protocol integration in the SDK

## Changes

- Implemented SparkProtocol class extending BaseProtocol
- Added Spark vault configuration constants
- Updated protocol router to include Spark protocol
- Added comprehensive tests for Spark protocol functionality

## Testing

- [x] All existing tests pass
- [x] New tests added for Spark protocol
- [x] Integration tests verify end-to-end functionality

## Breaking changes

None

Fixes #123
```

### Review process

- All PRs require at least one review
- Address review feedback promptly
- Keep PRs focused and reasonably sized
- Update documentation as needed

## Issue reporting

### Bug reports

When reporting bugs, include:

- **Clear description** of the issue
- **Steps to reproduce** the problem
- **Expected behavior** vs actual behavior
- **Environment details** (OS, Node version, etc.)
- **Code samples** if applicable
- **Screenshots** for UI issues

### Feature requests

For feature requests, provide:

- **Clear description** of the desired feature
- **Use case** and motivation
- **Proposed implementation** (if you have ideas)
- **Alternatives considered**

### Issue templates

Use the provided issue templates when available to ensure all necessary information is included

## License

By contributing to Mycelium SDK, you agree that your contributions will be licensed under the same dual license as the project:

- **Apache License 2.0 (Non-Commercial)** for non-commercial use
- **Commercial License** for commercial use

See [LICENSE](https://github.com/0xdeval/mycelium-sdk/blob/main/LICENSE) for full details

## Getting help

If you need help or have questions:

- **GitHub Discussions**: Use for general questions and discussions
- **GitHub Issues**: Use for bug reports and feature requests
- **Documentation**: Check the generated docs and README files

## Recognition

Contributors will be recognized in:

- Project README contributors section
- Release notes for significant contributions
- GitHub contributor statistics

Thank you for contributing to Mycelium SDK!
