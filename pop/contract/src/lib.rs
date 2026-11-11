//! Pay on Proof: an escrow that pays an agent only when its delivery passes a check the contract runs itself.
//!
//! The Warden is this contract's own account. It acts through a function-call key that can post, counter
//! and hire but cannot move funds. Any other account can bid and, once hired, deliver. A pass pays the
//! seller in NEAR or into its NEAR Intents balance as wNEAR. `spent + reserved` never passes `cap`.
use near_sdk::json_types::U128;
use near_sdk::serde_json::json;
use near_sdk::store::Vector;
use near_sdk::{env, near, require, AccountId, Gas, NearToken, PanicOnDefault, Promise};
use serde_json::Value;

pub mod checks;

const MAX_BIDS: usize = 8;
const MAX_DATA: usize = 4096;
const MAX_FAILS: u8 = 3;
const MIN_ASK: u128 = 1_000_000_000_000_000_000_000; // 0.001 NEAR
const STORAGE_BUFFER: u128 = 200_000_000_000_000_000_000_000; // 0.2 NEAR kept for bid and receipt storage
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
pub enum BidState { Open, Countered, Accepted, Final, Walked, Hired, Passed, Failed, Expired }

#[near(serializers = [borsh, json])]
#[derive(Clone, Debug)]
pub struct Bid {
    pub seller: AccountId,
    pub ask: U128,
    pub counter: Option<U128>,
    pub final_price: Option<U128>,
    pub rail: Rail,
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
    pub price: U128,
    pub due_ms: u64,
    pub fails: u8,
    pub deliverable: Option<String>,
}

#[near(serializers = [borsh, json])]
#[derive(Clone, Copy, PartialEq, Debug)]
#[serde(rename_all = "snake_case")]
pub enum Payout { None, Pending, Sent, Failed, FailedWrapped }

#[near(serializers = [borsh, json])]
#[derive(Clone, Debug)]
pub struct Receipt {
    pub id: u32,
    pub job: u32,
    pub kind: String,
    pub seller: AccountId,
    pub ask: U128,
    pub counter: Option<U128>,
    pub final_price: Option<U128>,
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
    receipts: Vector<Receipt>,
}

/// The bytes of the promise this callback waits on, or None when it failed.
fn last_result() -> Option<Vec<u8>> {
    env::promise_result_checked(0, 256).ok()
}

fn warden_only() { require!(env::predecessor_account_id() == env::current_account_id(), "Warden only"); }

#[near]
impl Contract {
    #[init]
    pub fn new(beneficiary: AccountId, cap: U128, wrap: AccountId, intents: AccountId) -> Self {
        warden_only();
        require!(cap.0 > 0, "cap must be above zero");
        Self { beneficiary, cap: cap.0, spent: 0, reserved: 0, wrap, intents, hired: 0, jobs: Vector::new(b"j"), receipts: Vector::new(b"r") }
    }

    /// Registers this contract with the wNEAR token so it can hold wNEAR on the way to NEAR Intents.
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
        require!(checks::KINDS.contains(&kind.as_str()), "unknown kind");
        require!(title.len() <= 80 && spec.len() <= 512, "title or spec too long");
        let parsed: Value = serde_json::from_str(&spec).unwrap_or_else(|_| env::panic_str("spec is not JSON"));
        if let Err(e) = checks::valid_spec(&kind, &parsed) { env::panic_str(e); }
        require!(budget.0 >= MIN_ASK, "budget too small");
        require!((5..=1440).contains(&window_mins), "window must be 5 to 1440 minutes");
        require!(self.spent + self.reserved + budget.0 <= self.cap, "over the cap");
        let storage = env::storage_byte_cost().as_yoctonear() * env::storage_usage() as u128;
        require!(env::account_balance().as_yoctonear() >= storage + self.reserved + budget.0 + STORAGE_BUFFER, "balance too low for this budget");
        self.reserved += budget.0;
        let id = self.jobs.len();
        self.jobs.push(Job {
            id, kind, title, spec, budget, window_ms: window_mins as u64 * 60_000, posted_ms: env::block_timestamp_ms(),
            state: JobState::Open, bids: Vec::new(), hired: None, price: U128(0), due_ms: 0, fails: 0, deliverable: None,
        });
        env::log_str(&format!("post_job {}", id));
        id
    }

    pub fn counter(&mut self, job_id: u32, bid: u8, price: U128) {
        warden_only();
        let job = self.job_mut(job_id);
        require!(job.state == JobState::Open, "job not open");
        let b = job.bids.get_mut(bid as usize).unwrap_or_else(|| env::panic_str("no such bid"));
        require!(b.state == BidState::Open && b.counter.is_none(), "one counter per bid");
        require!(price.0 > 0 && price.0 < b.ask.0, "counter must be under the ask");
        b.counter = Some(price);
        b.state = BidState::Countered;
    }

    pub fn hire(&mut self, job_id: u32, bid: u8) {
        warden_only();
        let now = env::block_timestamp_ms();
        let job = self.job_mut(job_id);
        require!(job.state == JobState::Open, "job not open");
        let b = job.bids.get_mut(bid as usize).unwrap_or_else(|| env::panic_str("no such bid"));
        let price = match b.state {
            BidState::Open => b.ask,
            BidState::Accepted => b.counter.unwrap(),
            BidState::Final => b.final_price.unwrap(),
            _ => env::panic_str("bid cannot be hired"),
        };
        require!(price.0 <= job.budget.0, "price over budget");
        b.state = BidState::Hired;
        job.hired = Some(bid);
        job.price = price;
        job.due_ms = now + job.window_ms;
        job.state = JobState::Hired;
        self.hired += 1;
    }

    pub fn cancel_job(&mut self, job_id: u32) {
        warden_only();
        let job = self.job_mut(job_id);
        require!(job.state == JobState::Open, "only an open job can be cancelled");
        job.state = JobState::Cancelled;
        let budget = job.budget.0;
        self.reserved -= budget;
    }

    /// Sends a failed payout again. A failed NEAR Intents deposit after a good wrap sends the wNEAR it holds.
    pub fn retry_payout(&mut self, receipt: u32) -> Promise {
        warden_only();
        let r = self.receipts.get(receipt).cloned().unwrap_or_else(|| env::panic_str("no such receipt"));
        require!(r.payout == Payout::Failed || r.payout == Payout::FailedWrapped, "payout not failed");
        self.receipts.get_mut(receipt).unwrap().payout = Payout::Pending;
        self.pay(receipt, &r.seller, r.price.0, r.rail, r.payout == Payout::FailedWrapped)
    }

    /// Turns wNEAR this contract holds back into NEAR, for example before `close`.
    pub fn unwrap_near(&mut self, amount: U128) -> Promise {
        warden_only();
        Promise::new(self.wrap.clone()).function_call("near_withdraw", json!({ "amount": amount }).to_string().into_bytes(), NearToken::from_yoctonear(1), Gas::from_tgas(10))
    }

    /* ------------------------------------------------------------ sellers */

    pub fn bid(&mut self, job_id: u32, ask: U128, rail: Rail, note: Option<String>) -> u8 {
        let seller = env::predecessor_account_id();
        require!(seller != env::current_account_id(), "the Warden cannot bid");
        let note = note.unwrap_or_default();
        require!(note.len() <= 140, "note too long");
        let now = env::block_timestamp_ms();
        let job = self.job_mut(job_id);
        require!(job.state == JobState::Open, "job not open");
        require!(job.bids.len() < MAX_BIDS, "job has all its bids");
        require!(!job.bids.iter().any(|b| b.seller == seller), "one bid per seller");
        require!(ask.0 >= MIN_ASK && ask.0 <= job.budget.0, "ask must be 0.001 NEAR to the budget");
        job.bids.push(Bid { seller, ask, counter: None, final_price: None, rail, state: BidState::Open, note, at_ms: now });
        (job.bids.len() - 1) as u8
    }

    /// The seller's one answer to a counter: "accept", "walk", or "final" with a price between counter and ask.
    pub fn respond(&mut self, job_id: u32, bid: u8, answer: String, final_price: Option<U128>) {
        let seller = env::predecessor_account_id();
        let job = self.job_mut(job_id);
        let b = job.bids.get_mut(bid as usize).unwrap_or_else(|| env::panic_str("no such bid"));
        require!(b.seller == seller, "not your bid");
        require!(b.state == BidState::Countered, "no counter to answer");
        match answer.as_str() {
            "accept" => b.state = BidState::Accepted,
            "walk" => b.state = BidState::Walked,
            "final" => {
                let p = final_price.unwrap_or_else(|| env::panic_str("final needs a price"));
                require!(p.0 > b.counter.unwrap().0 && p.0 < b.ask.0, "final must be between counter and ask");
                b.final_price = Some(p);
                b.state = BidState::Final;
            }
            _ => env::panic_str("answer is accept, final or walk"),
        }
    }

    /// The hired seller delivers. The contract checks the data here and pays on a pass.
    pub fn deliver(&mut self, job_id: u32, data: String) -> bool {
        let seller = env::predecessor_account_id();
        require!(data.len() <= MAX_DATA, "delivery over 4 KB");
        let now = env::block_timestamp_ms();
        let job = self.jobs.get(job_id).cloned().unwrap_or_else(|| env::panic_str("no such job"));
        require!(job.state == JobState::Hired, "nobody is hired");
        let bi = job.hired.unwrap() as usize;
        let b = &job.bids[bi];
        require!(b.seller == seller, "only the hired seller delivers");
        require!(now <= job.due_ms, "window closed; call expire");
        let spec: Value = serde_json::from_str(&job.spec).unwrap();
        let verdict = match serde_json::from_str::<Value>(&data) {
            Ok(v) => checks::check(&job.kind, &spec, &v),
            Err(_) => checks::Verdict { pass: false, reason: "delivery is not JSON".into() },
        };
        let (rail, price) = (b.rail, job.price);
        let rid = self.receipts.len();
        self.receipts.push(Receipt {
            id: rid, job: job_id, kind: job.kind.clone(), seller: seller.clone(), ask: b.ask, counter: b.counter, final_price: b.final_price,
            price, rail, pass: verdict.pass, reason: verdict.reason.clone(), at_ms: now, block: env::block_height(),
            payout: if verdict.pass { Payout::Pending } else { Payout::None },
        });
        self.hired -= 1;
        let j = self.jobs.get_mut(job_id).unwrap();
        if verdict.pass {
            j.bids[bi].state = BidState::Passed;
            j.state = JobState::Done;
            j.deliverable = Some(data);
            self.reserved -= j.budget.0;
            self.spent += price.0;
            env::log_str(&format!("pass job {} receipt {}: {}", job_id, rid, verdict.reason));
            self.pay(rid, &seller, price.0, rail, false).detach();
        } else {
            j.bids[bi].state = BidState::Failed;
            j.fails += 1;
            j.hired = None;
            if j.fails >= MAX_FAILS { j.state = JobState::Closed; self.reserved -= j.budget.0; } else { j.state = JobState::Open; }
            env::log_str(&format!("fail job {} receipt {}: {}", job_id, rid, verdict.reason));
        }
        verdict.pass
    }

    /// Anyone may reopen a job whose seller missed the delivery window.
    pub fn expire(&mut self, job_id: u32) {
        let now = env::block_timestamp_ms();
        let job = self.job_mut(job_id);
        require!(job.state == JobState::Hired && now > job.due_ms, "not overdue");
        let bi = job.hired.unwrap() as usize;
        job.bids[bi].state = BidState::Expired;
        job.hired = None;
        job.state = JobState::Open;
        self.hired -= 1;
    }

    /// The beneficiary takes back everything left. Refused while a seller is hired.
    pub fn close(&mut self) -> Promise {
        require!(env::predecessor_account_id() == self.beneficiary, "beneficiary only");
        require!(self.hired == 0, "a seller is hired");
        Promise::new(env::current_account_id()).delete_account(self.beneficiary.clone())
    }

    /* ------------------------------------------------------------ payment */

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

    /// For NEAR: did the transfer land. For NEAR Intents: did `ft_transfer_call` use the whole amount.
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

    /* ------------------------------------------------------------ views */

    pub fn get_config(&self) -> Value {
        json!({
            "warden": env::current_account_id(), "beneficiary": self.beneficiary, "cap": U128(self.cap), "spent": U128(self.spent),
            "reserved": U128(self.reserved), "hired": self.hired, "jobs": self.jobs.len(), "receipts": self.receipts.len(),
            "wrap": self.wrap, "intents": self.intents, "balance": U128(env::account_balance().as_yoctonear()),
        })
    }
    /// Runs a job's check on data without delivering it. Free to call, so a seller can test its work first.
    pub fn preview_check(&self, job_id: u32, data: String) -> Value {
        let job = self.jobs.get(job_id).unwrap_or_else(|| env::panic_str("no such job"));
        let spec: Value = serde_json::from_str(&job.spec).unwrap();
        let v = match serde_json::from_str::<Value>(&data) {
            Ok(d) if data.len() <= MAX_DATA => checks::check(&job.kind, &spec, &d),
            Ok(_) => checks::Verdict { pass: false, reason: "delivery over 4 KB".into() },
            Err(_) => checks::Verdict { pass: false, reason: "delivery is not JSON".into() },
        };
        json!({ "pass": v.pass, "reason": v.reason })
    }
    pub fn get_job(&self, job_id: u32) -> Option<Job> { self.jobs.get(job_id).cloned() }
    pub fn get_jobs(&self, from: Option<u32>, limit: Option<u32>) -> Vec<Job> {
        let from = from.unwrap_or(0);
        (from..self.jobs.len()).take(limit.unwrap_or(20).min(50) as usize).map(|i| self.jobs[i].clone()).collect()
    }
    pub fn get_open_jobs(&self) -> Vec<Job> {
        self.jobs.iter().filter(|j| j.state == JobState::Open).take(50).cloned().collect()
    }
    pub fn get_receipts(&self, from: Option<u32>, limit: Option<u32>) -> Vec<Receipt> {
        let from = from.unwrap_or(0);
        (from..self.receipts.len()).take(limit.unwrap_or(20).min(50) as usize).map(|i| self.receipts[i].clone()).collect()
    }

    fn job_mut(&mut self, id: u32) -> &mut Job { self.jobs.get_mut(id).unwrap_or_else(|| env::panic_str("no such job")) }
}

#[cfg(test)]
mod tests;
