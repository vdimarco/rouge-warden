//! A Pay on Proof job whose hired agent hires one more agent.
//!
//! The parent holds a function-call key on this contract and no full-access key. Its hire price is a
//! hard cap: a sub-job that would pass it panics. The sub-agent must be a sub-account of the parent.
//! A passing check pays the sub-agent from that cap, then pays the parent what is left.
//! `spent + reserved` never passes the contract cap. Testnet only. The locked mainnet contract is unchanged.
use near_sdk::json_types::U128;
use near_sdk::serde_json::json;
use near_sdk::store::Vector;
use near_sdk::{env, near, require, AccountId, Gas, NearToken, PanicOnDefault, Promise};
use serde_json::Value;

#[path = "../../../contract/src/checks.rs"]
mod checks;

const MAX_BIDS: usize = 8;
const MAX_SUBS: u8 = 8;
const MAX_DATA: usize = 4096;
const MAX_FAILS: u8 = 3;
const MIN_ASK: u128 = 1_000_000_000_000_000_000_000; // 0.001 NEAR
const STORAGE_BUFFER: u128 = 200_000_000_000_000_000_000_000; // 0.2 NEAR kept for storage
const GAS_WRAP: Gas = Gas::from_tgas(10);
const GAS_FT_CALL: Gas = Gas::from_tgas(60);
const GAS_CALLBACK: Gas = Gas::from_tgas(15);

#[near(serializers = [borsh, json])]
#[derive(Clone, Copy, PartialEq, Debug)]
#[serde(rename_all = "snake_case")]
pub enum Rail { Near, Intents }

#[near(serializers = [borsh, json])]
#[derive(Clone, Copy, PartialEq, Debug)]
#[serde(rename_all = "snake_case")]
pub enum BidState { Open, Hired, Passed, Failed }

#[near(serializers = [borsh, json])]
#[derive(Clone, Debug)]
pub struct Bid {
    pub seller: AccountId,
    pub ask: U128,
    pub rail: Rail,
    /// Account that receives this bid's pay. For the parent, this is not the locked agent account.
    pub owner: AccountId,
    pub state: BidState,
    pub note: String,
    pub at_ms: u64,
}

#[near(serializers = [borsh, json])]
#[derive(Clone, Copy, PartialEq, Debug)]
#[serde(rename_all = "snake_case")]
pub enum JobState { Open, Hired, Done, Closed, Cancelled }

#[near(serializers = [borsh, json])]
#[derive(Clone, Debug)]
pub struct Job {
    pub id: u32,
    pub kind: String,
    pub title: String,
    pub spec: String,
    pub budget: U128,
    pub window_ms: u64,
    pub posted_ms: u64,
    pub state: JobState,
    pub bids: Vec<Bid>,
    pub hired: Option<u8>,
    pub parent: Option<AccountId>,
    /// Where the parent's remainder is paid. Set when the parent is hired, and never changed.
    pub owner: Option<AccountId>,
    pub price: U128,
    pub paid_out: U128,
    pub sub_reserved: U128,
    pub sub_count: u8,
    pub due_ms: u64,
    pub fails: u8,
    pub deliverable: Option<String>,
}

#[near(serializers = [borsh, json])]
#[derive(Clone, Debug)]
pub struct SubJob {
    pub id: u32,
    pub parent_job: u32,
    pub kind: String,
    pub title: String,
    pub spec: String,
    pub budget: U128,
    pub window_ms: u64,
    pub posted_ms: u64,
    pub state: JobState,
    pub bids: Vec<Bid>,
    pub hired: Option<u8>,
    pub worker: Option<AccountId>,
    pub price: U128,
    pub due_ms: u64,
    pub fails: u8,
    pub deliverable: Option<String>,
}

#[near(serializers = [borsh, json])]
#[derive(Clone, Copy, PartialEq, Debug)]
#[serde(rename_all = "snake_case")]
pub enum Role { Parent, Sub }

#[near(serializers = [borsh, json])]
#[derive(Clone, Copy, PartialEq, Debug)]
#[serde(rename_all = "snake_case")]
pub enum Payout { None, Pending, Sent, Failed, FailedWrapped }

#[near(serializers = [borsh, json])]
#[derive(Clone, Debug)]
pub struct Receipt {
    pub id: u32,
    pub job: u32,
    pub sub: Option<u32>,
    pub role: Role,
    pub kind: String,
    pub seller: AccountId,
    pub price: U128,
    pub rail: Rail,
    pub pass: bool,
    pub reason: String,
    pub at_ms: u64,
    pub block: u64,
    pub payout: Payout,
}

#[near(contract_state)]
#[derive(PanicOnDefault)]
pub struct Contract {
    beneficiary: AccountId,
    cap: u128,
    spent: u128,
    reserved: u128,
    wrap: AccountId,
    intents: AccountId,
    hired: u32,
    jobs: Vector<Job>,
    subs: Vector<SubJob>,
    receipts: Vector<Receipt>,
}

fn last_result() -> Option<Vec<u8>> {
    env::promise_result_checked(0, 256).ok()
}

fn warden_only() { require!(env::predecessor_account_id() == env::current_account_id(), "Warden only"); }

fn is_subaccount(parent: &AccountId, child: &AccountId) -> bool {
    let p = parent.as_str();
    let c = child.as_str();
    c.len() > p.len() + 1 && c.ends_with(p) && c.as_bytes()[c.len() - p.len() - 1] == b'.'
}

fn parse_spec(kind: &str, spec: &str) -> Value {
    require!(checks::KINDS.contains(&kind), "unknown kind");
    require!(spec.len() <= 512, "spec too long");
    let parsed: Value = serde_json::from_str(spec).unwrap_or_else(|_| env::panic_str("spec is not JSON"));
    if let Err(e) = checks::valid_spec(kind, &parsed) { env::panic_str(e); }
    parsed
}

#[near]
impl Contract {
    #[init]
    pub fn new(beneficiary: AccountId, cap: U128, wrap: AccountId, intents: AccountId) -> Self {
        warden_only();
        require!(cap.0 > 0, "cap must be above zero");
        Self {
            beneficiary, cap: cap.0, spent: 0, reserved: 0, wrap, intents, hired: 0,
            jobs: Vector::new(b"j"), subs: Vector::new(b"s"), receipts: Vector::new(b"r"),
        }
    }

    pub fn register_wrap(&mut self) -> Promise {
        warden_only();
        Promise::new(self.wrap.clone()).function_call(
            "storage_deposit",
            json!({ "account_id": env::current_account_id(), "registration_only": true }).to_string().into_bytes(),
            NearToken::from_millinear(13),
            Gas::from_tgas(10),
        )
    }

    /* ------------------------------------------------------------ the Warden */

    pub fn post_job(&mut self, kind: String, title: String, spec: String, budget: U128, window_mins: u32) -> u32 {
        warden_only();
        require!(title.len() <= 80, "title too long");
        parse_spec(&kind, &spec);
        require!(budget.0 >= MIN_ASK, "budget too small");
        require!((5..=1440).contains(&window_mins), "window must be 5 to 1440 minutes");
        require!(self.spent + self.reserved + budget.0 <= self.cap, "over the cap");
        let storage = env::storage_byte_cost().as_yoctonear() * env::storage_usage() as u128;
        require!(env::account_balance().as_yoctonear() >= storage + self.reserved + budget.0 + STORAGE_BUFFER, "balance too low for this budget");
        self.reserved += budget.0;
        let id = self.jobs.len();
        self.jobs.push(Job {
            id, kind, title, spec, budget, window_ms: window_mins as u64 * 60_000, posted_ms: env::block_timestamp_ms(),
            state: JobState::Open, bids: Vec::new(), hired: None, parent: None, owner: None, price: U128(0), paid_out: U128(0),
            sub_reserved: U128(0), sub_count: 0, due_ms: 0, fails: 0, deliverable: None,
        });
        env::log_str(&format!("post_job {}", id));
        id
    }

    pub fn hire(&mut self, job_id: u32, bid: u8) {
        warden_only();
        let now = env::block_timestamp_ms();
        let job = self.job_mut(job_id);
        require!(job.state == JobState::Open, "job not open");
        let b = job.bids.get_mut(bid as usize).unwrap_or_else(|| env::panic_str("no such bid"));
        require!(b.state == BidState::Open, "bid cannot be hired");
        let price = b.ask;
        require!(price.0 <= job.budget.0, "price over budget");
        let parent = b.seller.clone();
        let owner = b.owner.clone();
        b.state = BidState::Hired;
        job.hired = Some(bid);
        job.parent = Some(parent);
        job.owner = Some(owner);
        job.price = price;
        job.due_ms = now + job.window_ms;
        job.state = JobState::Hired;
        self.hired += 1;
        env::log_str(&format!("hire job {} at {}", job_id, price.0));
    }

    pub fn cancel_job(&mut self, job_id: u32) {
        warden_only();
        let job = self.job_mut(job_id);
        require!(job.state == JobState::Open, "only an open job can be cancelled");
        job.state = JobState::Cancelled;
        let budget = job.budget.0;
        self.reserved -= budget;
    }

    pub fn retry_payout(&mut self, receipt: u32) -> Promise {
        warden_only();
        let r = self.receipts.get(receipt).cloned().unwrap_or_else(|| env::panic_str("no such receipt"));
        require!(r.payout == Payout::Failed || r.payout == Payout::FailedWrapped, "payout not failed");
        self.receipts.get_mut(receipt).unwrap().payout = Payout::Pending;
        self.pay(receipt, &r.seller, r.price.0, r.rail, r.payout == Payout::FailedWrapped)
    }

    pub fn unwrap_near(&mut self, amount: U128) -> Promise {
        warden_only();
        Promise::new(self.wrap.clone()).function_call("near_withdraw", json!({ "amount": amount }).to_string().into_bytes(), NearToken::from_yoctonear(1), Gas::from_tgas(10))
    }

    /* ------------------------------------------------------------ parent agent */

    pub fn bid(&mut self, job_id: u32, ask: U128, rail: Rail, owner: AccountId, note: Option<String>) -> u8 {
        let seller = env::predecessor_account_id();
        require!(seller != env::current_account_id(), "the Warden cannot bid");
        require!(owner != seller, "owner must be an account that can spend");
        require!(owner != env::current_account_id(), "the contract cannot be the owner");
        let note = note.unwrap_or_default();
        require!(note.len() <= 140, "note too long");
        let now = env::block_timestamp_ms();
        let job = self.job_mut(job_id);
        require!(job.state == JobState::Open, "job not open");
        require!(job.bids.len() < MAX_BIDS, "job has all its bids");
        require!(!job.bids.iter().any(|b| b.seller == seller), "one bid per seller");
        require!(ask.0 >= MIN_ASK && ask.0 <= job.budget.0, "ask must be 0.001 NEAR to the budget");
        job.bids.push(Bid { seller, ask, rail, owner, state: BidState::Open, note, at_ms: now });
        (job.bids.len() - 1) as u8
    }

    /// The hired parent posts a sub-job. The budget is taken from the parent's hire price, not added to the global reserve.
    pub fn post_subjob(&mut self, job_id: u32, kind: String, title: String, spec: String, budget: U128, window_mins: u32) -> u32 {
        let parent = env::predecessor_account_id();
        require!(title.len() <= 80, "title too long");
        parse_spec(&kind, &spec);
        require!(budget.0 >= MIN_ASK, "budget too small");
        require!((5..=1440).contains(&window_mins), "window must be 5 to 1440 minutes");
        let job = self.jobs.get(job_id).cloned().unwrap_or_else(|| env::panic_str("no such job"));
        require!(job.state == JobState::Hired, "parent job not hired");
        require!(job.parent.as_ref() == Some(&parent), "not the hired parent");
        require!(job.sub_count < MAX_SUBS, "too many sub-jobs");
        require!(job.paid_out.0 <= job.price.0 && job.sub_reserved.0 <= job.price.0 - job.paid_out.0, "books");
        let left = job.price.0 - job.paid_out.0 - job.sub_reserved.0;
        require!(budget.0 <= left, "over the cap");
        let id = self.subs.len();
        self.subs.push(SubJob {
            id, parent_job: job_id, kind, title, spec, budget, window_ms: window_mins as u64 * 60_000,
            posted_ms: env::block_timestamp_ms(), state: JobState::Open, bids: Vec::new(), hired: None, worker: None,
            price: U128(0), due_ms: 0, fails: 0, deliverable: None,
        });
        let job = self.job_mut(job_id);
        job.sub_reserved = U128(job.sub_reserved.0 + budget.0);
        job.sub_count += 1;
        env::log_str(&format!("post_subjob {} on {} budget {}", id, job_id, budget.0));
        id
    }

    pub fn hire_sub(&mut self, sub_id: u32, bid: u8) {
        let parent = env::predecessor_account_id();
        let now = env::block_timestamp_ms();
        let sub = self.subs.get(sub_id).cloned().unwrap_or_else(|| env::panic_str("no such sub-job"));
        let job = self.jobs.get(sub.parent_job).cloned().unwrap_or_else(|| env::panic_str("no such job"));
        require!(job.state == JobState::Hired && job.parent.as_ref() == Some(&parent), "not the hired parent");
        require!(sub.state == JobState::Open, "sub-job not open");
        let b = sub.bids.get(bid as usize).cloned().unwrap_or_else(|| env::panic_str("no such bid"));
        require!(b.state == BidState::Open, "bid cannot be hired");
        require!(b.ask.0 <= sub.budget.0, "price over budget");
        require!(is_subaccount(&parent, &b.seller), "worker must be a sub-account of the parent");
        let sub = self.sub_mut(sub_id);
        sub.bids[bid as usize].state = BidState::Hired;
        sub.hired = Some(bid);
        sub.worker = Some(b.seller);
        sub.price = b.ask;
        sub.due_ms = now + sub.window_ms;
        sub.state = JobState::Hired;
        self.hired += 1;
        env::log_str(&format!("hire_sub {} at {}", sub_id, b.ask.0));
    }

    pub fn cancel_subjob(&mut self, sub_id: u32) {
        let parent = env::predecessor_account_id();
        let sub = self.subs.get(sub_id).cloned().unwrap_or_else(|| env::panic_str("no such sub-job"));
        let job = self.jobs.get(sub.parent_job).cloned().unwrap_or_else(|| env::panic_str("no such job"));
        require!(job.parent.as_ref() == Some(&parent), "not the hired parent");
        require!(sub.state == JobState::Open, "only an open sub-job can be cancelled");
        self.sub_mut(sub_id).state = JobState::Cancelled;
        let job = self.job_mut(sub.parent_job);
        job.sub_reserved = U128(job.sub_reserved.0 - sub.budget.0);
    }

    pub fn deliver(&mut self, job_id: u32, data: String) -> bool {
        let seller = env::predecessor_account_id();
        require!(data.len() <= MAX_DATA, "delivery over 4 KB");
        let now = env::block_timestamp_ms();
        let job = self.jobs.get(job_id).cloned().unwrap_or_else(|| env::panic_str("no such job"));
        require!(job.state == JobState::Hired, "nobody is hired");
        require!(job.parent.as_ref() == Some(&seller), "only the hired parent delivers");
        require!(now <= job.due_ms, "window closed");
        require!(job.sub_reserved.0 == 0, "a sub-job is still open");
        let bi = job.hired.unwrap() as usize;
        let verdict = self.verdict(&job.kind, &job.spec, &data);
        let (rail, price, budget, paid) = (job.bids[bi].rail, job.price.0, job.budget.0, job.paid_out.0);
        let payee = job.owner.clone().unwrap_or_else(|| env::panic_str("no owner"));
        require!(payee != seller, "owner must be an account that can spend");
        require!(paid <= price && price <= budget, "books");
        let payout = price - paid;
        let rid = self.push_receipt(job_id, None, Role::Parent, &job.kind, &payee, payout, rail, &verdict, now);
        if verdict.pass {
            let j = self.job_mut(job_id);
            j.bids[bi].state = BidState::Passed;
            j.state = JobState::Done;
            j.deliverable = Some(data);
            j.paid_out = U128(price);
            self.reserved -= budget - paid;
            self.spent += payout;
            self.hired -= 1;
            env::log_str(&format!("pass parent job {} receipt {} paid {}: {}", job_id, rid, payee, verdict.reason));
            self.settle(rid, &payee, payout, rail);
        } else {
            let j = self.job_mut(job_id);
            j.fails += 1;
            env::log_str(&format!("fail parent job {} receipt {}: {}", job_id, rid, verdict.reason));
            if j.fails >= MAX_FAILS && j.sub_reserved.0 == 0 {
                j.state = JobState::Closed;
                let release = budget - paid;
                self.reserved -= release;
                self.hired -= 1;
            }
        }
        verdict.pass
    }

    /* ------------------------------------------------------------ sub-agent */

    pub fn bid_sub(&mut self, sub_id: u32, ask: U128, rail: Rail, note: Option<String>) -> u8 {
        let seller = env::predecessor_account_id();
        require!(seller != env::current_account_id(), "the Warden cannot bid");
        let note = note.unwrap_or_default();
        require!(note.len() <= 140, "note too long");
        let now = env::block_timestamp_ms();
        let sub = self.subs.get(sub_id).cloned().unwrap_or_else(|| env::panic_str("no such sub-job"));
        let job = self.jobs.get(sub.parent_job).cloned().unwrap_or_else(|| env::panic_str("no such job"));
        let parent = job.parent.unwrap_or_else(|| env::panic_str("parent job not hired"));
        require!(job.state == JobState::Hired, "parent job not hired");
        require!(seller != parent, "the parent cannot take its own sub-job");
        require!(is_subaccount(&parent, &seller), "worker must be a sub-account of the parent");
        require!(sub.state == JobState::Open, "sub-job not open");
        require!(sub.bids.len() < MAX_BIDS, "sub-job has all its bids");
        require!(!sub.bids.iter().any(|b| b.seller == seller), "one bid per seller");
        require!(ask.0 >= MIN_ASK && ask.0 <= sub.budget.0, "ask must be 0.001 NEAR to the budget");
        let sub = self.sub_mut(sub_id);
        sub.bids.push(Bid { seller: seller.clone(), ask, rail, owner: seller, state: BidState::Open, note, at_ms: now });
        (sub.bids.len() - 1) as u8
    }

    pub fn deliver_sub(&mut self, sub_id: u32, data: String) -> bool {
        let seller = env::predecessor_account_id();
        require!(data.len() <= MAX_DATA, "delivery over 4 KB");
        let now = env::block_timestamp_ms();
        let sub = self.subs.get(sub_id).cloned().unwrap_or_else(|| env::panic_str("no such sub-job"));
        require!(sub.state == JobState::Hired, "nobody is hired");
        require!(sub.worker.as_ref() == Some(&seller), "only the hired sub-agent delivers");
        require!(now <= sub.due_ms, "window closed");
        let bi = sub.hired.unwrap() as usize;
        let verdict = self.verdict(&sub.kind, &sub.spec, &data);
        let (rail, price, budget, parent_job) = (sub.bids[bi].rail, sub.price.0, sub.budget.0, sub.parent_job);
        let rid = self.push_receipt(parent_job, Some(sub_id), Role::Sub, &sub.kind, &seller, price, rail, &verdict, now);
        if verdict.pass {
            let s = self.sub_mut(sub_id);
            s.bids[bi].state = BidState::Passed;
            s.state = JobState::Done;
            s.deliverable = Some(data);
            let job = self.job_mut(parent_job);
            require!(job.sub_reserved.0 >= budget, "books");
            job.sub_reserved = U128(job.sub_reserved.0 - budget);
            job.paid_out = U128(job.paid_out.0 + price);
            self.reserved -= price;
            self.spent += price;
            self.hired -= 1;
            env::log_str(&format!("pass sub {} receipt {}: {}", sub_id, rid, verdict.reason));
            self.settle(rid, &seller, price, rail);
        } else {
            let fails = {
                let s = self.sub_mut(sub_id);
                s.fails += 1;
                s.fails
            };
            env::log_str(&format!("fail sub {} receipt {}: {}", sub_id, rid, verdict.reason));
            if fails >= MAX_FAILS {
                self.sub_mut(sub_id).state = JobState::Closed;
                let next = self.jobs.get(parent_job).unwrap().sub_reserved.0 - budget;
                self.job_mut(parent_job).sub_reserved = U128(next);
                self.hired -= 1;
            }
        }
        verdict.pass
    }

    pub fn close(&mut self) -> Promise {
        require!(env::predecessor_account_id() == self.beneficiary, "beneficiary only");
        require!(self.hired == 0, "a seller is hired");
        Promise::new(env::current_account_id()).delete_account(self.beneficiary.clone())
    }

    /* ------------------------------------------------------------ payment */

    fn settle(&self, rid: u32, seller: &AccountId, amount: u128, rail: Rail) {
        if amount == 0 {
            env::log_str(&format!("payout receipt {}: zero", rid));
            return;
        }
        self.pay(rid, seller, amount, rail, false).detach();
    }

    fn pay(&self, rid: u32, seller: &AccountId, amount: u128, rail: Rail, wrapped: bool) -> Promise {
        let me = Self::ext(env::current_account_id()).with_static_gas(GAS_CALLBACK);
        match rail {
            Rail::Near => Promise::new(seller.clone()).transfer(NearToken::from_yoctonear(amount)).then(me.on_paid(rid, false)),
            Rail::Intents if wrapped => self.ft_to_intents(seller, amount).then(me.on_paid(rid, true)),
            Rail::Intents => Promise::new(self.wrap.clone())
                .function_call("near_deposit", b"{}".to_vec(), NearToken::from_yoctonear(amount), GAS_WRAP)
                .then(Self::ext(env::current_account_id()).with_static_gas(GAS_FT_CALL.saturating_add(GAS_CALLBACK).saturating_add(Gas::from_tgas(10))).on_wrapped(rid)),
        }
    }

    fn ft_to_intents(&self, seller: &AccountId, amount: u128) -> Promise {
        Promise::new(self.wrap.clone()).function_call(
            "ft_transfer_call",
            json!({ "receiver_id": self.intents, "amount": U128(amount), "msg": seller.to_string() }).to_string().into_bytes(),
            NearToken::from_yoctonear(1),
            GAS_FT_CALL,
        )
    }

    #[private]
    pub fn on_wrapped(&mut self, rid: u32) -> Option<Promise> {
        if last_result().is_none() {
            self.receipts.get_mut(rid).unwrap().payout = Payout::Failed;
            return None;
        }
        let rc = self.receipts.get(rid).cloned().unwrap();
        let me = Self::ext(env::current_account_id()).with_static_gas(GAS_CALLBACK);
        Some(self.ft_to_intents(&rc.seller, rc.price.0).then(me.on_paid(rid, true)))
    }

    #[private]
    pub fn on_paid(&mut self, rid: u32, ft: bool) {
        let r = last_result();
        let rc = self.receipts.get_mut(rid).unwrap();
        rc.payout = match (ft, r) {
            (false, Some(_)) => Payout::Sent,
            (false, None) => Payout::Failed,
            (true, Some(bytes)) if serde_json::from_slice::<U128>(&bytes).map_or(false, |u| u.0 == rc.price.0) => Payout::Sent,
            (true, _) => Payout::FailedWrapped,
        };
        env::log_str(&format!("payout receipt {}: {:?}", rid, rc.payout));
    }

    fn settle_zero(&mut self, rid: u32) {
        let rc = self.receipts.get_mut(rid).unwrap();
        if rc.price.0 == 0 && rc.pass { rc.payout = Payout::Sent; }
    }

    /* ------------------------------------------------------------ views */

    pub fn get_config(&self) -> Value {
        json!({
            "warden": env::current_account_id(), "beneficiary": self.beneficiary, "cap": U128(self.cap), "spent": U128(self.spent),
            "reserved": U128(self.reserved), "hired": self.hired, "jobs": self.jobs.len(), "subs": self.subs.len(),
            "receipts": self.receipts.len(), "wrap": self.wrap, "intents": self.intents,
            "balance": U128(env::account_balance().as_yoctonear()),
        })
    }

    pub fn get_parent_cap(&self, job_id: u32) -> Value {
        let job = self.jobs.get(job_id).unwrap_or_else(|| env::panic_str("no such job"));
        let left = job.price.0.saturating_sub(job.paid_out.0).saturating_sub(job.sub_reserved.0);
        json!({
            "parent": job.parent, "owner": job.owner, "cap": job.price, "budget": job.budget, "paid_out": job.paid_out,
            "sub_reserved": job.sub_reserved, "left": U128(left), "state": job.state,
        })
    }

    pub fn preview_check(&self, job_id: u32, data: String) -> Value {
        let job = self.jobs.get(job_id).unwrap_or_else(|| env::panic_str("no such job"));
        let v = self.verdict(&job.kind, &job.spec, &data);
        json!({ "pass": v.pass, "reason": v.reason })
    }

    pub fn preview_sub(&self, sub_id: u32, data: String) -> Value {
        let sub = self.subs.get(sub_id).unwrap_or_else(|| env::panic_str("no such sub-job"));
        let v = self.verdict(&sub.kind, &sub.spec, &data);
        json!({ "pass": v.pass, "reason": v.reason })
    }

    pub fn get_job(&self, job_id: u32) -> Option<Job> { self.jobs.get(job_id).cloned() }
    pub fn get_sub(&self, sub_id: u32) -> Option<SubJob> { self.subs.get(sub_id).cloned() }
    pub fn get_jobs(&self, from: Option<u32>, limit: Option<u32>) -> Vec<Job> {
        let from = from.unwrap_or(0);
        (from..self.jobs.len()).take(limit.unwrap_or(20).min(50) as usize).map(|i| self.jobs[i].clone()).collect()
    }
    pub fn get_subs(&self, from: Option<u32>, limit: Option<u32>) -> Vec<SubJob> {
        let from = from.unwrap_or(0);
        (from..self.subs.len()).take(limit.unwrap_or(20).min(50) as usize).map(|i| self.subs[i].clone()).collect()
    }
    pub fn get_receipts(&self, from: Option<u32>, limit: Option<u32>) -> Vec<Receipt> {
        let from = from.unwrap_or(0);
        (from..self.receipts.len()).take(limit.unwrap_or(20).min(50) as usize).map(|i| self.receipts[i].clone()).collect()
    }

    fn verdict(&self, kind: &str, spec: &str, data: &str) -> checks::Verdict {
        if data.len() > MAX_DATA { return checks::Verdict { pass: false, reason: "delivery over 4 KB".into() }; }
        let spec: Value = serde_json::from_str(spec).unwrap();
        match serde_json::from_str::<Value>(data) {
            Ok(d) => checks::check(kind, &spec, &d),
            Err(_) => checks::Verdict { pass: false, reason: "delivery is not JSON".into() },
        }
    }

    fn push_receipt(&mut self, job: u32, sub: Option<u32>, role: Role, kind: &str, seller: &AccountId, price: u128, rail: Rail, verdict: &checks::Verdict, now: u64) -> u32 {
        let rid = self.receipts.len();
        self.receipts.push(Receipt {
            id: rid, job, sub, role, kind: kind.to_string(), seller: seller.clone(), price: U128(price), rail,
            pass: verdict.pass, reason: verdict.reason.clone(), at_ms: now, block: env::block_height(),
            payout: if verdict.pass && price > 0 { Payout::Pending } else { Payout::None },
        });
        if price == 0 && verdict.pass { self.settle_zero(rid); }
        rid
    }

    fn job_mut(&mut self, id: u32) -> &mut Job { self.jobs.get_mut(id).unwrap_or_else(|| env::panic_str("no such job")) }
    fn sub_mut(&mut self, id: u32) -> &mut SubJob { self.subs.get_mut(id).unwrap_or_else(|| env::panic_str("no such sub-job")) }
}

#[cfg(test)]
mod tests;
