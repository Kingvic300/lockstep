#!/usr/bin/env bash
# Deploy Lockstep to Stellar testnet. See deploy.sh for options.
NETWORK=testnet exec "$(dirname "$0")/deploy.sh" "$@"
