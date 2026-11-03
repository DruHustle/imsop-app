#!/usr/bin/env bash
set -euo pipefail
# The qualified main workflow owns publishing and its Oracle compatibility gates.
exec gh workflow run cicd-pipeline.yml --ref main --repo DruHustle/imsop-app-frontend
