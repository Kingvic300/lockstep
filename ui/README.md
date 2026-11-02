# Lockstep web app

Marketing site and batch builder for Lockstep, in one static React app.

## Pages

- **Landing (`#/`)**: why signed outcomes matter, how a batch works, features, developer example and FAQ.
- **Connect (`#/connect`)**: sign in with Freighter, LOBSTR or Albedo, on testnet or mainnet.
- **App (`#/app/…`)**:
  - **Dashboard**: XLM balance, batch stats, recent batches and quick-start templates.
  - **New batch**: add steps (the app reads each contract's interface for typed arguments), set guarantees and a deadline, see a plain-language summary, dry run, then sign once.
  - **Templates**: pay several people, swap with a minimum, send and confirm receipt, or a blank batch.
  - **History**: batches run from this browser, stored on this device only.
  - **Settings**: Lockstep contract ID, network and RPC, wallet.
- **Demo mode**: "Explore the live demo" opens the app with a sample batch and history. It needs no wallet and sends nothing to the network.

## Run

```sh
npm install
npm run dev        # http://localhost:5173
npm run build      # static files in dist/
```

Set the Lockstep contract in Settings, or at build time:

```sh
VITE_CONTRACT_ID=C... npm run build
```

## Notes

- Arguments of struct, vector or map type take JSON. Write large integers as strings ending in `n`, for example `"1000000n"`.
- Mainnet needs your own RPC URL. SDF runs no public mainnet RPC.
- LOBSTR and Albedo support is wired through their official packages but has not been tested against a live contract yet.
