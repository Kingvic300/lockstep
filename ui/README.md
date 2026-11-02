# Lockstep Composer

Web app for building and signing a Lockstep batch. Add contract calls in order, add guarantees about token balances, do a dry run, then sign once in Freighter.

## Run

```sh
npm install
npm run dev        # http://localhost:5173
npm run build      # static files in dist/
```

Open **Settings** and enter the Lockstep contract ID, or set it at build time:

```sh
VITE_CONTRACT_ID=C... npm run build
```

## Requirements

- [Freighter](https://freighter.app) browser wallet, set to the same network as the app.
- A Stellar RPC URL. Testnet uses `https://soroban-testnet.stellar.org` by default. Mainnet needs your own RPC or a provider's.

## How it works

- **Read functions** loads the target contract's interface from the network, including built-in Stellar Asset Contracts, so each argument gets a typed field.
- If the interface cannot be read, enter the function name and arguments by hand and pick each argument's type.
- Arguments of struct, vector or map type take JSON. Write large integers as strings ending in `n`, for example `"1000000n"`.
- **Dry run** simulates the batch from your account without signing. **Sign and run** simulates, asks Freighter to sign, submits and waits for the result.
