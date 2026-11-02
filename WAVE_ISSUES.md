# Wave issue backlog

Draft issues for the Stellar Wave program on Drips. Copy each one into a GitHub issue with the labels `wave` plus its size. Each issue should take one contributor about one week or less.

## Trivial

1. **Add a `version()` view** that returns the contract version string. Include a test.
2. **Test: `TooManyChecks`** with `MAX_CHECKS + 1` checks.
3. **Test: deadline equal to the ledger timestamp** is accepted (the boundary).
4. **Test: a failing inner call** (for example a swap with too little balance) rolls back earlier calls.
5. **Doc comments with examples** for `Call` and `BalanceCheck`.
6. **Write `docs/deploy-testnet.md`** with deploy and invoke commands for testnet.
7. **Add a `limits()` view** that returns `(MAX_CALLS, MAX_CHECKS)`.

## Medium

8. **Report which check failed.** Add separate error codes, or emit a diagnostic event before returning, so clients can show a clear message. Note that events are rolled back with the failed transaction, so design for simulation output.
9. **Exact-balance postcondition.** New check type: balance after equals a value.
10. **View-call postcondition.** New check type: call a read-only function on any contract and compare the `i128` result with a minimum.
11. **TypeScript batch builder.** A small package that builds `Call` and `BalanceCheck` values with `@stellar/stellar-sdk` and simulates the batch.
12. **Soroswap example.** An end-to-end example that swaps through two Soroswap pairs with a minimum-output check, on testnet.
13. **Resource-cost report.** Measure CPU, memory and ledger I/O for batches of 1, 4, 8 and 16 calls with `env.cost_estimate()`. Tune `MAX_CALLS` from the results.
14. **Auth tests with exact `MockAuth`.** Replace `mock_all_auths` and prove the signed tree contains the checks and the deadline.

## High

15. **Chained outputs.** Let a call argument refer to the return value of an earlier call, so swap output can feed a deposit. Design the encoding and add tests.
16. **Optional calls.** Per-call flag to allow failure without failing the batch, using `try_invoke_contract`. Checks still run at the end.
17. **Fuzz tests.** A `cargo fuzz` target with random batches against mock tokens. Assert that a passing batch always meets every check.
18. **Wallet integration demo.** A minimal web page with Stellar Wallets Kit that builds a batch, shows the checks in plain language, and asks the wallet to sign.
19. **Sponsored execution.** Document and test a flow where a relayer pays the fee with a fee-bump while the user signs only the Lockstep auth entry.
