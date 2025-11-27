#!/usr/bin/env node

import { config } from 'dotenv';
import { CLI } from './cli.js';

config();

async function main() {
  const cli = new CLI();
  await cli.start();
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
