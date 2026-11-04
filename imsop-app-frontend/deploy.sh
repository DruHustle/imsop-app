#!/usr/bin/env bash
set -euo pipefail
# The root workflow requalifies this exact source and verifies the deployed backend.
command -v gh >/dev/null || { echo 'GitHub CLI is required for release dispatch.' >&2; exit 1; }
exec gh workflow run deploy-frontend.yml --ref main --repo DruHustle/imsop-app
