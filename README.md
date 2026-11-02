# Lockstep

**Atomic batch calls with signed postconditions for Soroban.**

Lockstep lets a user sign one transaction that runs several contract calls in order and then checks the result. The user states what must be true at the end, for example "my USDC balance goes up by at least 95" and "my XLM balance goes down by at most 100". If any call fails, the deadline passes, or any check is not met, the whole transaction fails and nothing changes.

## Why

A Soroban transaction holds one `InvokeHostFunction` operation. Multi-step flows, such as swap then deposit then stake, need either several transactions or a contract that batches calls. Batch routers already exist on Stellar, for example Creit Tech's Stellar Router. Lockstep adds the part they leave to the caller: **guarantees about the outcome**.

- **Postconditions are part of what the user signs.** The checks are arguments to `execute`, and the user's signature covers them. A wallet, relayer or front-end cannot remove them.
- **Users trust the outcome, not every contract.** A swap route through three AMMs is safe to sign if the minimum output is enforced at the end.
- **Spend caps.** A negative `min_delta` limits how much an account can lose in the batch.
- **Deadline.** A signed batch cannot be held back and submitted later at a worse price.

## Live on testnet

| | |
|---|---|
| Lockstep contract | [`CBOA3SKHOLWCZRSEM6IFHGGFREFXWRXYFMH3FM7QTXT7AZRSXQXTRJ3C`](https://stellar.expert/explorer/testnet/contract/CBOA3SKHOLWCZRSEM6IFHGGFREFXWRXYFMH3FM7QTXT7AZRSXQXTRJ3C) |
| Example batch | [Two XLM transfers with a spend cap and a minimum-received check](https://stellar.expert/explorer/testnet/tx/72d6ffc71fa8996e72985df3a22c051bb7d8a1d8e510703669b35ae9d04a7519) |

The same batch with an impossible guarantee is refused with `Error(Contract, #6)` (`CheckFailed`), so nothing runs. The web app in `ui/` points at this contract by default.

### Try it

1. Install [Freighter](https://freighter.app) and switch it to testnet.
2. Fund your testnet account with friendbot in [Stellar Lab](https://lab.stellar.org).
3. Start the app:

   ```sh
   cd ui && npm install && npm run dev
   ```

4. Open **Templates**, choose **Pay several people**, add two recipients with XLM amounts, then **Dry run** and **Sign and run** in the composer.

Prefer no wallet? Press **Explore the live demo** on the landing page for a sample batch and history.

## How it works

```
user signs: execute(caller, calls[], checks[], deadline)
                 │
                 ├─ caller.require_auth()          (signature covers everything)
                 ├─ deadline / size / self-call checks
                 ├─ read balance for each check     (before)
                 ├─ run each call in order          (env.invoke_contract)
                 └─ read balance for each check     (after)
                       after - before >= min_delta  else Error::CheckFailed
                                                    ─► whole tx rolls back
```

### Contract interface

```rust
struct Call         { contract: Address, func: Symbol, args: Vec<Val> }
struct BalanceCheck { token: Address, account: Address, min_delta: i128 }

fn execute(caller: Address, calls: Vec<Call>, checks: Vec<BalanceCheck>, deadline: u64)
    -> Result<Vec<Val>, Error>
```

Returns the return value of each call, in order.

Errors: `Expired`, `EmptyBatch`, `TooManyCalls` (max 16), `TooManyChecks` (max 16), `SelfCall`, `CheckFailed`.

### Auth

The caller signs one authorization tree. Its root is `Lockstep.execute`, and every inner call that needs the caller's auth (for example a token transfer inside a swap) sits under that root. Simulation with `simulateTransaction` builds this tree for you.

Lockstep holds no funds and no state. Every call runs with the caller's own authorization, never Lockstep's.

## Known limits (v0.1)

- **Balance checks only.** Other postcondition types are on the roadmap (see below).
- **Failed check index is not reported.** A failed check returns `CheckFailed` without saying which one failed. Simulate first to find out.
- **No per-call "allow failure" mode.** Every call must succeed.
- **No audit yet.**

## Build and test

Requirements: Rust stable, `rustup target add wasm32v1-none`, and stellar-cli v25.2.0 or newer.

```sh
cargo test               # 7 unit tests, native
stellar contract build   # wasm in target/wasm32v1-none/release/
```

## Deploy

See [DEPLOY.md](DEPLOY.md). `scripts/deploy-testnet.sh` deploys to testnet with a funded test identity. `scripts/deploy-mainnet.sh` deploys with your own stellar-cli key after a confirmation. Both point the web app at the new contract.

## Web UI

`ui/` holds Lockstep Composer: a web app that builds a batch step by step, adds balance guarantees, shows a plain-language summary of what you sign, and runs a dry run before you sign in Freighter. See [ui/README.md](ui/README.md).

```sh
cd ui && npm install && npm run dev
```

## Roadmap

1. **v0.1 (now):** batch execution, balance postconditions, deadline, self-call guard. Unit tests.
2. **v0.2:** more postcondition types (exact balance, contract view result equals or is at least a value), output of call N used as input to call N+1, and a TypeScript SDK that builds batches and checks.
3. **v0.3:** testnet deployment, a wallet integration demo, real-AMM examples (Soroswap, Aquarius), and an audit through the SCF Audit Bank.
4. **v1.0:** mainnet release.

See [WAVE_ISSUES.md](WAVE_ISSUES.md) for open work sized for Drips Wave contributors.

## License

Apache-2.0
