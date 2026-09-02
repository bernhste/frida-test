#!/usr/bin/env node

import("../dist/cli-frida-test-compiler.js").catch((err) => {
  console.error("Failed to load the CLI module. Make sure the project is built.");
  console.error(err);
  process.exit(1);
});
