#![cfg(test)]
extern crate std;

use super::*;
use soroban_sdk::{
    contract, contractimpl, symbol_short,
    testutils::{Address as _, Ledger},
    token::{StellarAssetClient, TokenClient},
    vec, Env, IntoVal,
};

/// Fixed-rate swap used as a stand-in for an AMM.
#[contract]
pub struct MockSwap;

#[contractimpl]
impl MockSwap {
    pub fn swap(
        env: Env,
        user: Address,
        token_in: Address,
        token_out: Address,
        amount_in: i128,
        amount_out: i128,
    ) -> i128 {
        user.require_auth();
        let me = env.current_contract_address();
        TokenClient::new(&env, &token_in).transfer(&user, &me, &amount_in);
        TokenClient::new(&env, &token_out).transfer(&me, &user, &amount_out);
        amount_out
    }
}

struct Setup<'a> {
    env: Env,
    lockstep: LockstepClient<'a>,
    swap: Address,
    a: TokenClient<'a>,
    b: TokenClient<'a>,
    user: Address,
}

fn setup<'a>() -> Setup<'a> {
    let env = Env::default();
    env.mock_all_auths();
    env.ledger().set_timestamp(1_000);

    let issuer = Address::generate(&env);
    let a = env
        .register_stellar_asset_contract_v2(issuer.clone())
        .address();
    let b = env.register_stellar_asset_contract_v2(issuer).address();

    let swap = env.register(MockSwap, ());
    let user = Address::generate(&env);
    StellarAssetClient::new(&env, &a).mint(&user, &1_000);
    StellarAssetClient::new(&env, &b).mint(&swap, &1_000);

    let lockstep = LockstepClient::new(&env, &env.register(Lockstep, ()));
    Setup {
        a: TokenClient::new(&env, &a),
        b: TokenClient::new(&env, &b),
        env,
        lockstep,
        swap,
        user,
    }
}

fn swap_call(s: &Setup, amount_in: i128, amount_out: i128) -> Call {
    Call {
        contract: s.swap.clone(),
        func: symbol_short!("swap"),
        args: vec![
            &s.env,
            s.user.into_val(&s.env),
            s.a.address.into_val(&s.env),
            s.b.address.into_val(&s.env),
            amount_in.into_val(&s.env),
            amount_out.into_val(&s.env),
        ],
    }
}

fn check(s: &Setup, token: &Address, min_delta: i128) -> BalanceCheck {
    BalanceCheck {
        token: token.clone(),
        account: s.user.clone(),
        min_delta,
    }
}

#[test]
fn batch_runs_and_checks_pass() {
    let s = setup();
    let calls = vec![&s.env, swap_call(&s, 100, 90), swap_call(&s, 100, 95)];
    let checks = vec![
        &s.env,
        check(&s, &s.b.address, 180),
        check(&s, &s.a.address, -200),
    ];
    let out = s.lockstep.execute(&s.user, &calls, &checks, &2_000);
    assert_eq!(out.len(), 2);
    assert_eq!(s.a.balance(&s.user), 800);
    assert_eq!(s.b.balance(&s.user), 185);
}

#[test]
fn failed_check_rolls_back_every_call() {
    let s = setup();
    let calls = vec![&s.env, swap_call(&s, 100, 90), swap_call(&s, 100, 95)];
    let checks = vec![&s.env, check(&s, &s.b.address, 200)];
    assert_eq!(
        s.lockstep.try_execute(&s.user, &calls, &checks, &2_000),
        Err(Ok(Error::CheckFailed))
    );
    assert_eq!(s.a.balance(&s.user), 1_000);
    assert_eq!(s.b.balance(&s.user), 0);
}

#[test]
fn spend_cap_check() {
    let s = setup();
    let calls = vec![&s.env, swap_call(&s, 300, 90)];
    let checks = vec![&s.env, check(&s, &s.a.address, -200)];
    assert_eq!(
        s.lockstep.try_execute(&s.user, &calls, &checks, &2_000),
        Err(Ok(Error::CheckFailed))
    );
    assert_eq!(s.a.balance(&s.user), 1_000);
}

#[test]
fn expired_deadline() {
    let s = setup();
    let calls = vec![&s.env, swap_call(&s, 100, 90)];
    assert_eq!(
        s.lockstep.try_execute(&s.user, &calls, &vec![&s.env], &999),
        Err(Ok(Error::Expired))
    );
}

#[test]
fn rejects_empty_and_oversized_batches() {
    let s = setup();
    assert_eq!(
        s.lockstep
            .try_execute(&s.user, &vec![&s.env], &vec![&s.env], &2_000),
        Err(Ok(Error::EmptyBatch))
    );
    let mut calls = vec![&s.env];
    for _ in 0..=MAX_CALLS {
        calls.push_back(swap_call(&s, 1, 1));
    }
    assert_eq!(
        s.lockstep
            .try_execute(&s.user, &calls, &vec![&s.env], &2_000),
        Err(Ok(Error::TooManyCalls))
    );
}

#[test]
fn rejects_self_call() {
    let s = setup();
    let calls = vec![
        &s.env,
        Call {
            contract: s.lockstep.address.clone(),
            func: symbol_short!("execute"),
            args: vec![&s.env],
        },
    ];
    assert_eq!(
        s.lockstep
            .try_execute(&s.user, &calls, &vec![&s.env], &2_000),
        Err(Ok(Error::SelfCall))
    );
}

#[test]
fn caller_signs_whole_batch() {
    let s = setup();
    let calls = vec![&s.env, swap_call(&s, 100, 90)];
    s.lockstep.execute(
        &s.user,
        &calls,
        &vec![&s.env, check(&s, &s.b.address, 90)],
        &2_000,
    );
    let auths = s.env.auths();
    assert_eq!(auths.len(), 1);
    assert_eq!(auths[0].0, s.user);
    // Root of the signed tree is Lockstep.execute; the swap is nested under it.
    assert_eq!(auths[0].1.sub_invocations.len(), 1);
}
