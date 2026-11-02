#!/usr/bin/env bash
# Deploy Lockstep to Stellar mainnet. See deploy.sh for options.
NETWORK=mainnet exec "$(dirname "$0")/deploy.sh" "$@"
