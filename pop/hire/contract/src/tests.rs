use super::*;
use near_sdk::test_utils::VMContextBuilder;
use near_sdk::testing_env;

const N: u128 = 1_000_000_000_000_000_000_000_000;

fn me() -> AccountId { "hire.near".parse().unwrap() }
fn parent() -> AccountId { "parent.near".parse().unwrap() }
fn owner() -> AccountId { "owner.near".parse().unwrap() }
fn crew() -> AccountId { "crew.parent.near".parse().unwrap() }
fn stranger() -> AccountId { "stranger.near".parse().unwrap() }

fn ctx(pred: &AccountId, ms: u64) {
    testing_env!(VMContextBuilder::new()
        .current_account_id(me())
        .predecessor_account_id(pred.clone())
        .account_balance(NearToken::from_near(50))
        .block_timestamp(ms * 1_000_000)
        .build());
}

fn setup() -> Contract {
    ctx(&me(), 1);
    Contract::new("ben.near".parse().unwrap(), U128(2 * N), "wrap.near".parse().unwrap(), "intents.near".parse().unwrap())
}

const MAP_SPEC: &str = r#"{"rooms":3,"cols":4,"rows":3}"#;
const GOOD_MAP: &str = r#"{"rooms":[[0,0],[1,0],[1,1]],"links":[[[0,0],[1,0]],[[1,0],[1,1]]],"entry":[0,0],"exit":[1,1]}"#;
const ROSTER_SPEC: &str = r#"{"lo":8,"hi":12,"size":3}"#;
const GOOD_ROSTER: &str = r#"{"critters":[{"name":"Goose","threat":3},{"name":"Bear","threat":5},{"name":"Raccoon","threat":2}]}"#;
const BAD_ROSTER: &str = r#"{"critters":[{"name":"Goose","threat":1},{"name":"Bear","threat":1},{"name":"Raccoon","threat":1}]}"#;

fn post_and_hire(c: &mut Contract, budget: u128) -> u32 {
    ctx(&me(), 10);
    let id = c.post_job("map".into(), "Dock".into(), MAP_SPEC.into(), U128(budget), 30);
    ctx(&parent(), 20);
    let b = c.bid(id, U128(budget), Rail::Near, owner(), Some("I will hire a hand".into()));
    ctx(&me(), 30);
    c.hire(id, b);
    id
}

#[test]
fn sub_then_parent_pays_from_the_cap() {
    let mut c = setup();
    let id = post_and_hire(&mut c, N / 2);
    ctx(&parent(), 40);
    let sid = c.post_subjob(id, "roster".into(), "Hands".into(), ROSTER_SPEC.into(), U128(N / 5), 30);
    ctx(&crew(), 50);
    let b = c.bid_sub(sid, U128(N / 5), Rail::Near, None);
    ctx(&parent(), 60);
    c.hire_sub(sid, b);
    ctx(&crew(), 70);
    assert!(c.deliver_sub(sid, GOOD_ROSTER.into()));
    ctx(&parent(), 80);
    assert!(c.deliver(id, GOOD_MAP.into()));

    let rec = c.get_receipts(None, None);
    assert_eq!(rec.len(), 2);
    assert!(rec[0].pass && rec[0].role == Role::Sub && rec[0].price.0 == N / 5 && rec[0].payout == Payout::Pending);
    assert!(rec[1].pass && rec[1].role == Role::Parent && rec[1].seller == owner() && rec[1].rail == Rail::Near && rec[1].price.0 == N / 2 - N / 5);
    assert_eq!(c.get_job(id).unwrap().owner, Some(owner()));
    assert_eq!(c.get_job(id).unwrap().parent, Some(parent()));
    assert_eq!(c.spent, N / 2);
    assert_eq!(c.reserved, 0);
    assert_eq!(c.get_job(id).unwrap().state, JobState::Done);
    assert_eq!(c.get_sub(sid).unwrap().state, JobState::Done);
    let cap = c.get_parent_cap(id);
    let paid = (N / 2).to_string();
    assert_eq!(cap["left"].as_str(), Some("0"));
    assert_eq!(cap["paid_out"].as_str(), Some(paid.as_str()));
}

#[test]
#[should_panic(expected = "owner must be an account that can spend")]
fn the_parent_cannot_name_itself_as_owner() {
    let mut c = setup();
    ctx(&me(), 10);
    let id = c.post_job("map".into(), "Dock".into(), MAP_SPEC.into(), U128(N / 2), 30);
    ctx(&parent(), 20);
    c.bid(id, U128(N / 2), Rail::Near, parent(), None);
}

#[test]
#[should_panic(expected = "over the cap")]
fn subjob_over_the_parent_cap_is_refused() {
    let mut c = setup();
    let id = post_and_hire(&mut c, N / 2);
    ctx(&parent(), 40);
    c.post_subjob(id, "roster".into(), "Too big".into(), ROSTER_SPEC.into(), U128(N / 2 + N / 10), 30);
}

#[test]
#[should_panic(expected = "over the cap")]
fn a_second_subjob_cannot_pass_what_is_left() {
    let mut c = setup();
    let id = post_and_hire(&mut c, N / 2);
    ctx(&parent(), 40);
    c.post_subjob(id, "roster".into(), "Hands".into(), ROSTER_SPEC.into(), U128(N / 5), 30);
    c.post_subjob(id, "roster".into(), "More".into(), ROSTER_SPEC.into(), U128(N / 2), 30);
}

#[test]
fn overspend_leaves_the_books_unchanged() {
    let mut c = setup();
    let id = post_and_hire(&mut c, N / 2);
    let before = (c.spent, c.reserved, c.get_job(id).unwrap().sub_reserved.0);
    ctx(&parent(), 40);
    let trapped = std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| {
        c.post_subjob(id, "roster".into(), "Too big".into(), ROSTER_SPEC.into(), U128(N / 2 + N / 10), 30);
    })).is_err();
    assert!(trapped);
    assert_eq!((c.spent, c.reserved, c.get_job(id).unwrap().sub_reserved.0), before);
    assert_eq!(c.get_subs(None, None).len(), 0);
}

#[test]
#[should_panic(expected = "worker must be a sub-account of the parent")]
fn a_stranger_cannot_bid_the_subjob() {
    let mut c = setup();
    let id = post_and_hire(&mut c, N / 2);
    ctx(&parent(), 40);
    let sid = c.post_subjob(id, "roster".into(), "Hands".into(), ROSTER_SPEC.into(), U128(N / 5), 30);
    ctx(&stranger(), 50);
    c.bid_sub(sid, U128(N / 5), Rail::Near, None);
}

#[test]
#[should_panic(expected = "not the hired parent")]
fn only_the_parent_posts_a_subjob() {
    let mut c = setup();
    let id = post_and_hire(&mut c, N / 2);
    ctx(&crew(), 40);
    c.post_subjob(id, "roster".into(), "Hands".into(), ROSTER_SPEC.into(), U128(N / 5), 30);
}

#[test]
fn a_failed_sub_delivery_pays_nothing() {
    let mut c = setup();
    let id = post_and_hire(&mut c, N / 2);
    ctx(&parent(), 40);
    let sid = c.post_subjob(id, "roster".into(), "Hands".into(), ROSTER_SPEC.into(), U128(N / 5), 30);
    ctx(&crew(), 50);
    let b = c.bid_sub(sid, U128(N / 5), Rail::Near, None);
    ctx(&parent(), 60);
    c.hire_sub(sid, b);
    ctx(&crew(), 70);
    assert!(!c.deliver_sub(sid, BAD_ROSTER.into()));
    let r = &c.get_receipts(None, None)[0];
    assert!(!r.pass && r.payout == Payout::None);
    assert_eq!(c.spent, 0);
    assert_eq!(c.reserved, N / 2);
    assert_eq!(c.get_job(id).unwrap().paid_out.0, 0);
    assert_eq!(c.get_job(id).unwrap().sub_reserved.0, N / 5);
    assert_eq!(c.get_sub(sid).unwrap().state, JobState::Hired);
}

#[test]
#[should_panic(expected = "a sub-job is still open")]
fn the_parent_cannot_deliver_while_a_subjob_is_open() {
    let mut c = setup();
    let id = post_and_hire(&mut c, N / 2);
    ctx(&parent(), 40);
    c.post_subjob(id, "roster".into(), "Hands".into(), ROSTER_SPEC.into(), U128(N / 5), 30);
    c.deliver(id, GOOD_MAP.into());
}

#[test]
#[should_panic(expected = "over the cap")]
fn the_global_cap_still_holds() {
    let mut c = setup();
    ctx(&me(), 10);
    c.post_job("map".into(), "A".into(), MAP_SPEC.into(), U128(N), 30);
    c.post_job("map".into(), "B".into(), MAP_SPEC.into(), U128(N), 30);
    c.post_job("map".into(), "C".into(), MAP_SPEC.into(), U128(MIN_ASK), 30);
}

#[test]
fn cancel_subjob_returns_the_earmark() {
    let mut c = setup();
    let id = post_and_hire(&mut c, N / 2);
    ctx(&parent(), 40);
    let sid = c.post_subjob(id, "roster".into(), "Hands".into(), ROSTER_SPEC.into(), U128(N / 5), 30);
    let left_during = (N / 2 - N / 5).to_string();
    let left_after = (N / 2).to_string();
    assert_eq!(c.get_parent_cap(id)["left"].as_str(), Some(left_during.as_str()));
    c.cancel_subjob(sid);
    assert_eq!(c.get_sub(sid).unwrap().state, JobState::Cancelled);
    assert_eq!(c.get_parent_cap(id)["left"].as_str(), Some(left_after.as_str()));
    assert_eq!(c.reserved, N / 2);
    assert_eq!(c.spent, 0);
}
