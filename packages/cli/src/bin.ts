#!/usr/bin/env node

import { runCli } from './index';

runCli(process.argv)
  .then((code) => {
    process.exit(code);
  })
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  });
