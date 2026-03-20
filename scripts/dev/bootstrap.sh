#!/usr/bin/env bash
set -euo pipefail

echo "Bootstrapping AEP local development"

echo "Checking Node.js version..."
node -v
npm -v

echo "Installing dependencies..."
npm install

echo "Checking Wrangler..."
npx wrangler --version

echo "Next steps:"
echo "- create D1 database"
echo "- apply migrations"
echo "- run sample worker deploy test"
echo "- run wrangler dev for control plane"
