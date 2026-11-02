#!/usr/bin/env bash
# Deploy Lockstep to Stellar mainnet.
#
# You sign with your own key. This script never reads or prints secret keys.
#
# Required environment:
#   STELLAR_RPC_URL   Mainnet RPC URL from a provider (SDF runs no public mainnet RPC)
#   SOURCE            stellar-cli identity that pays for and signs the deploy
#                     (create it with: stellar keys add <name>)
set -euo pipefail

PASSPHRASE="Public Global Stellar Network ; September 2015"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"

die() { echo "error: $*" >&2; exit 1; }
command -v stellar >/dev/null || die "stellar-cli is not installed. See README > Build and test."
: "${STELLAR_RPC_URL:?set STELLAR_RPC_URL to a mainnet RPC URL}"
: "${SOURCE:?set SOURCE to your stellar-cli identity name}"

cat <<SUMMARY

  Lockstep MAINNET deploy
  -----------------------
  Signer identity : $SOURCE ($(stellar keys address "$SOURCE"))

  Lockstep holds no funds and has no admin, so there is nothing to configure.
  WARNING: Lockstep v0.1 has NOT been audited. Users sign real transactions through it.
  This deploy spends real XLM from the signer account.

SUMMARY
read -r -p "Type DEPLOY to continue: " answer
[ "$answer" = "DEPLOY" ] || die "cancelled"

echo "Building wasm…"
(cd "$ROOT" && stellar contract build)
WASM="$ROOT/target/wasm32v1-none/release/soroban_lockstep.wasm"
[ -f "$WASM" ] || die "wasm not found at $WASM"

echo "Deploying…"
ID="$(stellar contract deploy --wasm "$WASM" --source "$SOURCE" \
  --rpc-url "$STELLAR_RPC_URL" --network-passphrase "$PASSPHRASE" --alias lockstep)"

echo
echo "Lockstep deployed: $ID"
echo "Explorer: https://stellar.expert/explorer/public/contract/$ID"

cat > "$ROOT/ui/.env.production" <<ENV
VITE_NETWORK=mainnet
VITE_CONTRACT_ID=$ID
ENV
printf 'VITE_RPC_URL=%s\n' "$STELLAR_RPC_URL" > "$ROOT/ui/.env.production.local"
echo "Wrote ui/.env.production (commit it) and ui/.env.production.local (RPC URL, not committed)."
