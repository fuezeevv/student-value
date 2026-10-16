#!/usr/bin/env bash
set -euo pipefail
export PUPPETEER_SKIP_DOWNLOAD=true
npm ci --include=dev
npm run build:production

# The running service and pre-deploy job only retain production dependencies.
npm prune --omit=dev --ignore-scripts
