#!/usr/bin/env bash
# Deploy Lockstep to Stellar testnet or mainnet.
# Use scripts/deploy-testnet.sh or scripts/deploy-mainnet.sh.
#
# This script never reads or prints secret keys.
#
# Environment:
#   NETWORK           testnet | mainnet
#   STELLAR_RPC_URL   RPC URL. Defaults to SDF's testnet RPC. Required for mainnet.
#   SOURCE            stellar-cli identity that pays for and signs the deploy.
#                     On testnet it defaults to "lockstep-testnet", created and funded by friendbot.
#                     On mainnet create it yourself: stellar keys add <name>
#   YES=1             Skip the confirmation prompt (testnet only).
set -euo pipefail

NETWORK="${NETWORK:-testnet}"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"

die() { echo "error: $*" >&2; exit 1; }
command -v stellar >/dev/null || die "stellar-cli is not installed. See DEPLOY.md."

case "$NETWORK" in
  testnet)
    PASSPHRASE="Test SDF Network ; September 2015"
    STELLAR_RPC_URL="${STELLAR_RPC_URL:-https://soroban-testnet.stellar.org}"
    EXPLORER="testnet"
    SOURCE="${SOURCE:-lockstep-testnet}"
    if ! stellar keys address "$SOURCE" >/dev/null 2>&1; then
      echo "Creating test identity $SOURCE and funding it with friendbot…"
      stellar keys generate "$SOURCE" --network testnet --fund
    fi
    ;;
  mainnet)
    PASSPHRASE="Public Global Stellar Network ; September 2015"
    EXPLORER="public"
    : "${STELLAR_RPC_URL:?set STELLAR_RPC_URL to a mainnet RPC URL}"
    : "${SOURCE:?set SOURCE to your stellar-cli identity name}"
    ;;
  *) die "NETWORK must be testnet or mainnet" ;;
esac

if [ "$NETWORK" = testnet ] && [ "$STELLAR_RPC_URL" = "https://soroban-testnet.stellar.org" ]; then
  NET=(--network testnet)
else
  NET=(--rpc-url "$STELLAR_RPC_URL" --network-passphrase "$PASSPHRASE")
fi

cat <<SUMMARY

  Lockstep deploy on $NETWORK
  ---------------------------
  Signer identity : $SOURCE ($(stellar keys address "$SOURCE"))
  Lockstep holds no funds and has no admin, so there is nothing to configure.

SUMMARY
if [ "$NETWORK" = mainnet ]; then
  echo "  WARNING: Lockstep v0.1 has NOT been audited. Users sign real transactions through it."
  echo "  This deploy spends real XLM from the signer account."
  echo
  read -r -p "Type DEPLOY to continue: " answer
  [ "$answer" = "DEPLOY" ] || die "cancelled"
elif [ "${YES:-}" != 1 ]; then
  read -r -p "Deploy to testnet? [y/N] " answer
  [ "$answer" = y ] || [ "$answer" = Y ] || die "cancelled"
fi

echo "Building wasm…"
(cd "$ROOT" && stellar contract build)
WASM="$ROOT/target/wasm32v1-none/release/soroban_lockstep.wasm"
[ -f "$WASM" ] || die "wasm not found at $WASM"

echo "Deploying…"
ID="$(stellar contract deploy --wasm "$WASM" --source "$SOURCE" "${NET[@]}" --alias "lockstep-contract-$NETWORK")"

echo
echo "Lockstep deployed: $ID"
echo "Explorer: https://stellar.expert/explorer/$EXPLORER/contract/$ID"

if [ "$NETWORK" = mainnet ]; then
  printf 'VITE_NETWORK=mainnet\nVITE_CONTRACT_ID=%s\n' "$ID" > "$ROOT/ui/.env.production"
  printf 'VITE_RPC_URL=%s\n' "$STELLAR_RPC_URL" > "$ROOT/ui/.env.production.local"
  echo "Wrote ui/.env.production (commit it) and ui/.env.production.local (RPC URL, not committed)."
else
  printf 'VITE_NETWORK=testnet\nVITE_CONTRACT_ID=%s\n' "$ID" > "$ROOT/ui/.env"
  echo "Wrote ui/.env (commit it). Run: cd ui && npm run dev"
fi
