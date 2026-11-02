#![no_std]
//! Lockstep: atomic batch calls with postconditions for Soroban.
//!
//! A caller signs one `execute` invocation that holds a list of contract
//! calls, a list of balance checks and a deadline. Lockstep runs the calls in
//! order, then checks every balance. If any call fails, the deadline has
//! passed, or any balance moved less than the signed minimum, the whole
//! invocation fails and every state change rolls back.
//!
//! Because the checks are inside the signed arguments, a relayer or front-end
//! cannot drop them, and the caller gets a guaranteed outcome ("I end up with
//! at least 95 USDC more, and spend at most 100 XLM") instead of trusting each
//! contract in the batch.

use soroban_sdk::{
    contract, contracterror, contractimpl, contracttype, token, Address, Env, Symbol, Val, Vec,
};

pub const MAX_CALLS: u32 = 16;
pub const MAX_CHECKS: u32 = 16;

#[contracterror]
#[derive(Copy, Clone, Debug, Eq, PartialEq, PartialOrd, Ord)]
#[repr(u32)]
pub enum Error {
    Expired = 1,
    EmptyBatch = 2,
    TooManyCalls = 3,
    TooManyChecks = 4,
    SelfCall = 5,
    CheckFailed = 6,
}

/// One contract invocation in the batch.
#[contracttype]
#[derive(Clone, Debug)]
pub struct Call {
    pub contract: Address,
    pub func: Symbol,
    pub args: Vec<Val>,
}

/// Postcondition on a token balance.
///
/// After all calls, `balance(account) - balance_before(account)` must be
/// greater than or equal to `min_delta`. Use a positive value for "I must
/// receive at least X" and a negative value for "I may spend at most X".
#[contracttype]
#[derive(Clone, Debug)]
pub struct BalanceCheck {
    pub token: Address,
    pub account: Address,
    pub min_delta: i128,
}

#[contract]
pub struct Lockstep;

#[contractimpl]
impl Lockstep {
    /// Run `calls` atomically for `caller`, then enforce `checks`.
    ///
    /// Returns the return value of every call, in order.
    pub fn execute(
        env: Env,
        caller: Address,
        calls: Vec<Call>,
        checks: Vec<BalanceCheck>,
        deadline: u64,
    ) -> Result<Vec<Val>, Error> {
        // Signing covers calls, checks and deadline together.
        caller.require_auth();

        if env.ledger().timestamp() > deadline {
            return Err(Error::Expired);
        }
        if calls.is_empty() {
            return Err(Error::EmptyBatch);
        }
        if calls.len() > MAX_CALLS {
            return Err(Error::TooManyCalls);
        }
        if checks.len() > MAX_CHECKS {
            return Err(Error::TooManyChecks);
        }
        let me = env.current_contract_address();
        for call in calls.iter() {
            if call.contract == me {
                return Err(Error::SelfCall);
            }
        }

        let mut before: Vec<i128> = Vec::new(&env);
        for check in checks.iter() {
            before.push_back(token::TokenClient::new(&env, &check.token).balance(&check.account));
        }

        let mut results: Vec<Val> = Vec::new(&env);
        for call in calls.iter() {
            let out: Val = env.invoke_contract(&call.contract, &call.func, call.args);
            results.push_back(out);
        }

        for (i, check) in checks.iter().enumerate() {
            let after = token::TokenClient::new(&env, &check.token).balance(&check.account);
            let start = before.get_unchecked(i as u32);
            let delta = after.checked_sub(start).ok_or(Error::CheckFailed)?;
            if delta < check.min_delta {
                return Err(Error::CheckFailed);
            }
        }

        Ok(results)
    }
}

#[cfg(test)]
mod test;
