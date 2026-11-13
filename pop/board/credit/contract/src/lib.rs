//! Testnet credit score for Pay on Proof.
//!
//! Scores come from cross-contract reads of the locked hire contract and the locked appeals
//! contract. A caller cannot submit a pass, a fail, or a jury result. The mainnet escrow is not
//! writable from testnet, so it is not a source here. The public board reads mainnet itself.
use near_sdk::json_types::U128;
use near_sdk::serde::Deserialize;
use near_sdk::serde_json::{json, Value};
use near_sdk::store::{LookupMap, Vector};
use near_sdk::{env, near, require, AccountId, Gas, NearToken, PanicOnDefault, Promise, PromiseError};

const HIRE: &str = "v2-contract-mwfheysi.testnet";
const APPEALS: &str = "popa-mwfhb3x4.testnet";

pub const PASS_W: i64 = 10;
pub const FAIL_W: i64 = 8;
pub const WIN_W: i64 = 15;
pub const LOSS_W: i64 = 12;
pub const BASE_BUDGET: u128 = 20_000_000_000_000_000_000_000;
pub const STEP_BUDGET: u128 = 20_000_000_000_000_000_000_000;
pub const NEG_BUDGET: u128 = 10_000_000_000_000_000_000_000;
pub const DEPOSIT_ZERO: u128 = 50_000_000_000_000_000_000_000;
pub const DEPOSIT_STEP: u128 = 4_000_000_000_000_000_000_000;
pub const DEPOSIT_FLOOR: u128 = 1_000_000_000_000_000_000_000;

const GAS_VIEW: Gas = Gas::from_tgas(80);
const GAS_CB: Gas = Gas::from_tgas(40);

#[derive(Deserialize)]
#[serde(crate = "near_sdk::serde")]
pub struct InReceipt {
    seller: AccountId,
    price: U128,
    pass: bool,
    payout: String,
}

#[derive(Deserialize)]
#[serde(crate = "near_sdk::serde")]
pub struct InDispute {
    worker: AccountId,
    price: U128,
    status: String,
}

#[near(serializers = [borsh])]
#[derive(Clone)]
struct Agent {
    agent: AccountId,
    hire_pass: u32,
    hire_fail: u32,
    hire_earned: u128,
    appeal_pass: u32,
    appeal_fail: u32,
    appeal_earned: u128,
    jury_wins: u32,
    jury_losses: u32,
    jury_earned: u128,
}

impl Agent {
    fn blank(agent: AccountId) -> Self {
        Self {
            agent,
            hire_pass: 0, hire_fail: 0, hire_earned: 0,
            appeal_pass: 0, appeal_fail: 0, appeal_earned: 0,
            jury_wins: 0, jury_losses: 0, jury_earned: 0,
        }
    }
}

#[near(serializers = [borsh])]
#[derive(Clone)]
struct StoredDispute {
    id: u32,
    worker: AccountId,
    price: u128,
    status: String,
}

#[near(serializers = [borsh])]
#[derive(Clone)]
struct Stake {
    agent: AccountId,
    budget: u128,
    deposit: u128,
    refunded: bool,
}

pub struct Totals {
    passes: u32,
    fails: u32,
    jury_wins: u32,
    jury_losses: u32,
    earned: u128,
}

fn totals(a: &Agent) -> Totals {
    Totals {
        passes: a.hire_pass + a.appeal_pass,
        fails: a.hire_fail + a.appeal_fail,
        jury_wins: a.jury_wins,
        jury_losses: a.jury_losses,
        earned: a.hire_earned + a.appeal_earned + a.jury_earned,
    }
}

pub fn score_of(t: &Totals) -> i64 {
    t.passes as i64 * PASS_W + t.jury_wins as i64 * WIN_W - t.fails as i64 * FAIL_W - t.jury_losses as i64 * LOSS_W
}

pub fn limits_from_score(score: i64) -> (u128, u128) {
    if score >= 0 {
        let s = score as u128;
        let max_budget = BASE_BUDGET + s * STEP_BUDGET;
        let cut = s * DEPOSIT_STEP;
        let mut min_deposit = if DEPOSIT_ZERO > cut { DEPOSIT_ZERO - cut } else { 0 };
        if min_deposit < DEPOSIT_FLOOR { min_deposit = DEPOSIT_FLOOR; }
        (max_budget, min_deposit)
    } else {
        let n = (-score) as u128;
        (NEG_BUDGET, DEPOSIT_ZERO + n * DEPOSIT_STEP)
    }
}

fn hire_id() -> AccountId { HIRE.parse().unwrap() }
fn appeals_id() -> AccountId { APPEALS.parse().unwrap() }

#[near(contract_state)]
#[derive(PanicOnDefault)]
pub struct Contract {
    rows: Vector<Agent>,
    index: LookupMap<AccountId, u32>,
    disputes: Vector<StoredDispute>,
    stakes: Vector<Stake>,
    hire_next: u32,
    appeals_next: u32,
    hire_height: u64,
    appeals_height: u64,
    probes: u32,
}

#[near]
impl Contract {
    #[init]
    pub fn new() -> Self {
        require!(env::predecessor_account_id() == env::current_account_id(), "contract only");
        Self {
            rows: Vector::new(b"a"),
            index: LookupMap::new(b"i"),
            disputes: Vector::new(b"d"),
            stakes: Vector::new(b"s"),
            hire_next: 0,
            appeals_next: 0,
            hire_height: 0,
            appeals_height: 0,
            probes: 0,
        }
    }

    /// Replaces hire counts when `from` is 0, then appends this page. Pages must be pulled in order.
    pub fn pull_hire(&mut self, from: u32) -> Promise {
        Promise::new(hire_id()).function_call(
            "get_receipts",
            json!({ "from": from, "limit": 50 }).to_string().into_bytes(),
            NearToken::from_yoctonear(0),
            GAS_VIEW,
        ).then(Self::ext(env::current_account_id()).with_static_gas(GAS_CB).on_hire(from))
    }

    pub fn pull_appeals(&mut self, from: u32) -> Promise {
        Promise::new(appeals_id()).function_call(
            "get_receipts",
            json!({ "from": from, "limit": 50 }).to_string().into_bytes(),
            NearToken::from_yoctonear(0),
            GAS_VIEW,
        ).then(Self::ext(env::current_account_id()).with_static_gas(GAS_CB).on_appeals(from))
    }

    pub fn begin_disputes(&mut self) {
        self.disputes.clear();
        self.recompute_jury();
        env::log_str("disputes cleared");
    }

    /// Reads one appeals dispute. Ids must be pulled from 0 upward after `begin_disputes`.
    pub fn pull_dispute(&mut self, id: u32) -> Promise {
        require!(id == self.disputes.len(), "pull disputes in order");
        Promise::new(appeals_id()).function_call(
            "get_dispute",
            json!({ "dispute_id": id }).to_string().into_bytes(),
            NearToken::from_yoctonear(0),
            GAS_VIEW,
        ).then(Self::ext(env::current_account_id()).with_static_gas(GAS_CB).on_dispute(id))
    }

    /// Records that `agent` could take this budget with this deposit. Panics when the score says no.
    pub fn probe(&mut self, agent: AccountId, budget: U128, deposit: U128) {
        self.gate(&agent, budget.0, deposit.0);
        self.probes += 1;
        env::log_str(&format!("probe ok {agent}"));
    }

    /// Locks the predecessor's deposit when their score allows the budget.
    #[payable]
    pub fn stake(&mut self, budget: U128) {
        let agent = env::predecessor_account_id();
        let deposit = env::attached_deposit().as_yoctonear();
        self.gate(&agent, budget.0, deposit);
        self.stakes.push(Stake { agent: agent.clone(), budget: budget.0, deposit, refunded: false });
        env::log_str(&format!("stake ok {agent} budget {} deposit {deposit}", budget.0));
    }

    pub fn refund(&mut self) -> Promise {
        let agent = env::predecessor_account_id();
        let mut found = None;
        for i in (0..self.stakes.len()).rev() {
            let s = self.stakes.get(i).unwrap();
            if s.agent == agent && !s.refunded { found = Some(i); break; }
        }
        let idx = found.unwrap_or_else(|| env::panic_str("no stake"));
        let amount = self.stakes.get(idx).unwrap().deposit;
        self.stakes.get_mut(idx).unwrap().refunded = true;
        Promise::new(agent).transfer(NearToken::from_yoctonear(amount)).then(
            Self::ext(env::current_account_id()).with_static_gas(Gas::from_tgas(15)).on_refund(idx),
        )
    }

    #[private]
    pub fn on_hire(&mut self, from: u32, #[callback_result] rows: Result<Vec<InReceipt>, PromiseError>) {
        self.on_receipts(true, from, rows);
    }

    #[private]
    pub fn on_appeals(&mut self, from: u32, #[callback_result] rows: Result<Vec<InReceipt>, PromiseError>) {
        self.on_receipts(false, from, rows);
    }

    #[private]
    pub fn on_dispute(&mut self, id: u32, #[callback_result] row: Result<Option<InDispute>, PromiseError>) {
        require!(id == self.disputes.len(), "pull disputes in order");
        match row {
            Ok(Some(d)) => {
                self.disputes.push(StoredDispute { id, worker: d.worker, price: d.price.0, status: d.status });
                self.recompute_jury();
                env::log_str(&format!("pull dispute {id}"));
            }
            Ok(None) => env::log_str("no dispute"),
            Err(_) => env::log_str("pull dispute failed"),
        }
    }

    #[private]
    pub fn on_refund(&mut self, idx: u32, #[callback_result] transfer: Result<(), PromiseError>) {
        if transfer.is_err() {
            if let Some(s) = self.stakes.get_mut(idx) { s.refunded = false; }
            env::log_str("refund failed");
        } else {
            env::log_str("refund sent");
        }
    }

    pub fn get_config(&self) -> Value {
        json!({
            "contract": env::current_account_id(),
            "hire": HIRE,
            "appeals": APPEALS,
            "agents": self.rows.len(),
            "disputes": self.disputes.len(),
            "stakes": self.stakes.len(),
            "probes": self.probes,
            "hire_next": self.hire_next,
            "appeals_next": self.appeals_next,
            "hire_height": self.hire_height,
            "appeals_height": self.appeals_height,
            "formula": {
                "pass": PASS_W, "fail": FAIL_W, "jury_win": WIN_W, "jury_loss": LOSS_W,
                "base_budget": U128(BASE_BUDGET), "step_budget": U128(STEP_BUDGET), "neg_budget": U128(NEG_BUDGET),
                "deposit_at_zero": U128(DEPOSIT_ZERO), "deposit_step": U128(DEPOSIT_STEP), "deposit_floor": U128(DEPOSIT_FLOOR),
            },
        })
    }

    pub fn get_agents(&self) -> Vec<Value> {
        (0..self.rows.len()).map(|i| self.agent_json(&self.rows[i])).collect()
    }

    pub fn get_stakes(&self) -> Vec<Value> {
        self.stakes.iter().map(|s| json!({
            "agent": s.agent, "budget": U128(s.budget), "deposit": U128(s.deposit), "refunded": s.refunded,
        })).collect()
    }

    pub fn get_limits(&self, agent: AccountId) -> Value {
        if let Some(i) = self.index.get(&agent).copied() {
            return self.agent_json(&self.rows[i]);
        }
        self.agent_json(&Agent::blank(agent))
    }
}

impl Contract {
    fn on_receipts(&mut self, hire: bool, from: u32, rows: Result<Vec<InReceipt>, PromiseError>) {
        let rows = match rows {
            Ok(v) => v,
            Err(_) => {
                env::log_str(if hire { "pull hire failed" } else { "pull appeals failed" });
                return;
            }
        };
        let n = rows.len();
        if hire { self.apply_hire(from, rows); } else { self.apply_appeals(from, rows); }
        env::log_str(&format!("pull {} from {from} count {n}", if hire { "hire" } else { "appeals" }));
    }

    fn apply_hire(&mut self, from: u32, rows: Vec<InReceipt>) {
        if from == 0 {
            self.zero_hire();
            self.hire_next = 0;
        }
        require!(from == self.hire_next, "pull hire pages in order");
        let n = rows.len() as u32;
        for r in rows {
            let i = self.touch(&r.seller);
            let row = self.rows.get_mut(i).unwrap();
            if r.pass { row.hire_pass += 1; } else { row.hire_fail += 1; }
            if r.pass && r.payout == "sent" { row.hire_earned += r.price.0; }
        }
        self.hire_next = from + n;
        self.hire_height = env::block_height();
    }

    fn apply_appeals(&mut self, from: u32, rows: Vec<InReceipt>) {
        if from == 0 {
            self.zero_appeals();
            self.appeals_next = 0;
        }
        require!(from == self.appeals_next, "pull appeals pages in order");
        let n = rows.len() as u32;
        for r in rows {
            let i = self.touch(&r.seller);
            let row = self.rows.get_mut(i).unwrap();
            if r.pass { row.appeal_pass += 1; } else { row.appeal_fail += 1; }
            if r.pass && r.payout == "sent" { row.appeal_earned += r.price.0; }
        }
        self.appeals_next = from + n;
        self.appeals_height = env::block_height();
    }

    fn zero_hire(&mut self) {
        for i in 0..self.rows.len() {
            let row = self.rows.get_mut(i).unwrap();
            row.hire_pass = 0;
            row.hire_fail = 0;
            row.hire_earned = 0;
        }
    }

    fn zero_appeals(&mut self) {
        for i in 0..self.rows.len() {
            let row = self.rows.get_mut(i).unwrap();
            row.appeal_pass = 0;
            row.appeal_fail = 0;
            row.appeal_earned = 0;
        }
    }

    fn recompute_jury(&mut self) {
        for i in 0..self.rows.len() {
            let row = self.rows.get_mut(i).unwrap();
            row.jury_wins = 0;
            row.jury_losses = 0;
            row.jury_earned = 0;
        }
        let copy: Vec<StoredDispute> = self.disputes.iter().cloned().collect();
        for d in copy {
            let i = self.touch(&d.worker);
            let row = self.rows.get_mut(i).unwrap();
            if d.status == "paid" {
                row.jury_wins += 1;
                row.jury_earned += d.price;
            } else if d.status == "refunded" {
                row.jury_losses += 1;
            }
        }
    }

    fn touch(&mut self, id: &AccountId) -> u32 {
        if let Some(i) = self.index.get(id).copied() { return i; }
        let i = self.rows.len();
        self.rows.push(Agent::blank(id.clone()));
        self.index.insert(id.clone(), i);
        i
    }

    fn gate(&self, agent: &AccountId, budget: u128, deposit: u128) {
        require!(budget > 0, "budget must be above zero");
        let blank = Agent::blank(agent.clone());
        let row = self.index.get(agent).copied().map(|i| self.rows[i].clone()).unwrap_or(blank);
        let t = totals(&row);
        let score = score_of(&t);
        let (max_budget, min_deposit) = limits_from_score(score);
        env::log_str(&format!("gate {agent} score {score} max {max_budget} min {min_deposit} budget {budget} deposit {deposit}"));
        require!(budget <= max_budget, "score too low for this budget");
        require!(deposit >= min_deposit, "deposit too small for this score");
    }

    fn agent_json(&self, a: &Agent) -> Value {
        let t = totals(a);
        let score = score_of(&t);
        let (max_budget, min_deposit) = limits_from_score(score);
        json!({
            "agent": a.agent,
            "passes": t.passes,
            "fails": t.fails,
            "jury_wins": t.jury_wins,
            "jury_losses": t.jury_losses,
            "earned": U128(t.earned),
            "score": score,
            "max_budget": U128(max_budget),
            "min_deposit": U128(min_deposit),
        })
    }
}

#[cfg(test)]
mod tests;
