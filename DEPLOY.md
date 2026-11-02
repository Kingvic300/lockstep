# Deploying Lockstep to mainnet

Lockstep v0.1 is **not audited**. It holds no funds, but users sign real transactions through it. Label the app as beta and plan an audit through the SCF Audit Bank.

## 1. Install stellar-cli

```sh
sudo apt install -y libudev-dev libdbus-1-dev pkg-config build-essential
cargo install --locked stellar-cli
stellar --version
```

Or install the `.deb` package from the [stellar-cli releases](https://github.com/stellar/stellar-cli/releases).

## 2. Add your signing key

```sh
stellar keys add deployer
```

Enter your secret key or seed phrase when prompted. It stays in stellar-cli's key store on your machine. The account must hold enough XLM for the deploy fees and the minimum reserve.

## 3. Get a mainnet RPC URL

SDF runs no public mainnet RPC. Pick a provider from the [Stellar RPC providers list](https://developers.stellar.org/docs/data/rpc/rpc-providers) and copy your endpoint URL.

## 4. Deploy

```sh
export STELLAR_RPC_URL="https://your-provider-endpoint"
export SOURCE=deployer
./scripts/deploy-mainnet.sh
```

Lockstep has no admin and no settings. The script shows a summary, asks you to type `DEPLOY`, builds the wasm, deploys with your key and prints the contract ID.

## 5. Build the web app for mainnet

The script writes `ui/.env.production` (network and contract ID, safe to commit) and `ui/.env.production.local` (your RPC URL, not committed).

```sh
cd ui
npm install
npm run build      # static site in ui/dist, defaults to mainnet and your Lockstep contract
```

Host `ui/dist` on any static host, such as GitHub Pages, Netlify or Vercel. Note that the RPC URL is visible to anyone who opens the site, so use a provider key you are willing to expose, or put the RPC behind your own proxy.
