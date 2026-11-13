use super::*;
use near_sdk::test_utils::VMContextBuilder;
use near_sdk::testing_env;

const SPEC: &str = r#"{"size":2,"lo":4,"hi":8}"#;
const GOOD: &str = r#"{"critters":[{"name":"A","threat":2},{"name":"B","threat":3}]}"#;
const BAD: &str = r#"{"critters":[{"name":"A","threat":5},{"name":"B","threat":5}]}"#;
const FUND: u128 = 200_000_000_000_000_000_000_000; // 0.2
const BUDGET: u128 = 150_000_000_000_000_000_000_000; // 0.15

fn me() -> AccountId { "pool.testnet".parse().unwrap() }
fn named(s: &str) -> AccountId { s.parse().unwrap() }

fn ctx(pred: &AccountId, deposit: u128) {
    testing_env!(VMContextBuilder::new()
        .current_account_id(me())
        .predecessor_account_id(pred.clone())
        .attached_deposit(NearToken::from_yoctonear(deposit))
        .account_balance(NearToken::from_near(30))
        .prepaid_gas(near_sdk::Gas::from_tgas(200))
        .block_timestamp(1_700_000_000_000_000_000)
        .build());
}

fn setup() -> Contract {
    ctx(&me(), 0);
    Contract::new(named("ben.testnet"))
}

fn fund_two(c: &mut Contract) {
    ctx(&named("a.testnet"), FUND);
    c.fund();
    ctx(&named("b.testnet"), FUND);
    c.fund();
}

#[test]
fn a_bad_roster_pays_nothing_and_a_good_one_pays() {
    let mut c = setup();
    fund_two(&mut c);
    ctx(&named("a.testnet"), 0);
    let id = c.open_job("roster".into(), "Den watch".into(), SPEC.into(), U128(BUDGET));
    ctx(&named("worker.testnet"), 0);
    c.take(id);
    assert!(!c.deliver(id, BAD.into()));
    let fail = &c.get_receipts(None, None)[0];
    assert!(!fail.pass);
    assert_eq!(fail.payout, Payout::None);
    assert_eq!(fail.reason, "threat 10, too deadly (4 to 8)");
    assert_eq!(c.spent, 0);
    assert_eq!(c.reserved, BUDGET);
    assert!(c.deliver(id, GOOD.into()));
    let pass = &c.get_receipts(None, None)[1];
    assert!(pass.pass);
    assert_eq!(pass.payout, Payout::Pending);
    assert_eq!(pass.reason, "threat 5, inside 4 to 8");
    assert_eq!(c.spent, BUDGET);
    assert_eq!(c.reserved, 0);
    assert_eq!(c.get_jobs(None, None)[0].state, JobState::Done);
    assert_eq!(c.preview_check(id, GOOD.into())["pass"], true);
}

#[test]
#[should_panic(expected = "only a funder opens a job")]
fn a_stranger_cannot_open() {
    let mut c = setup();
    fund_two(&mut c);
    ctx(&named("worker.testnet"), 0);
    c.open_job("roster".into(), "Den watch".into(), SPEC.into(), U128(BUDGET));
}

#[test]
#[should_panic(expected = "poster cannot take the job")]
fn the_poster_cannot_take_it() {
    let mut c = setup();
    fund_two(&mut c);
    ctx(&named("a.testnet"), 0);
    let id = c.open_job("roster".into(), "Den watch".into(), SPEC.into(), U128(BUDGET));
    c.take(id);
}

#[test]
fn three_fails_return_the_budget_to_the_pool() {
    let mut c = setup();
    fund_two(&mut c);
    let before = c.pool;
    ctx(&named("a.testnet"), 0);
    let id = c.open_job("roster".into(), "Den watch".into(), SPEC.into(), U128(BUDGET));
    assert_eq!(c.pool, before - BUDGET);
    ctx(&named("worker.testnet"), 0);
    c.take(id);
    assert!(!c.deliver(id, BAD.into()));
    assert!(!c.deliver(id, BAD.into()));
    assert!(!c.deliver(id, BAD.into()));
    assert_eq!(c.pool, before);
    assert_eq!(c.spent, 0);
    assert_eq!(c.get_jobs(None, None)[0].state, JobState::Closed);
}

#[test]
fn two_funds_from_one_account_add_up() {
    let mut c = setup();
    ctx(&named("a.testnet"), FUND);
    c.fund();
    ctx(&named("a.testnet"), FUND);
    c.fund();
    let funders = c.get_funders();
    assert_eq!(funders.len(), 1);
    assert_eq!(funders[0]["amount"].as_str().unwrap(), (FUND * 2).to_string());
    assert_eq!(c.pool, FUND * 2);
}
