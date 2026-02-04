#!/bin/bash

# Fix AMM test issues
cd /workspaces/BOXMEOUT_STELLA/contracts/contracts/boxmeout

# Remove unused imports and fix warnings
cargo fix --lib --tests --allow-dirty --allow-staged

# Try to compile and see remaining issues
cargo check --tests
