//! Testnet escrow. It pays the hired seller only when a verdict signed inside the TEE checker verifies.
//!
//! The checker binary is named by its sha256. OutLayer runs that binary in an Intel TDX worker and the
//! guest signs with a key that exists only for this binary and this contract. This contract checks that
//! signature. It does not see the delivery. The delivery is a ciphertext the guest opens.
//!
//! This contract is deployed on testnet only. The mainnet Pay on Proof contract is a different program.
use near_sdk::json_types::U128;
use near_sdk::serde_json::{json, Value};
use near_sdk::store::Vector;
use near_sdk::{env, near, require, AccountId, Gas, NearToken, PanicOnDefault, Promise};

const MAX_BIDS: usize = 8;
const MAX_FAILS: u8 = 3;
const MIN_ASK: u128 = 1_000_000_000_000_000_000_000; // 0.001 NEAR
const STORAGE_BUFFER: u128 = 100_000_000_000_000_000_000_000; // 0.1 NEAR
const MIN_CHECK_DEPOSIT: u128 = 20_000_000_000_000_000_000_000; // 0.02 NEAR attached for the worker
const GAS_CALL: Gas = Gas::from_tgas(180);
const GAS_SETTLE: Gas = Gas::from_tgas(60);
const GAS_PAID: Gas = Gas::from_tgas(15);

#[near(serializers = [borsh, json])]
#[derive(Clone, Copy, PartialEq, Debug)]
#[serde(rename_all = "snake_case")]
pub enum BidState { Open, Hired, Passed, Failed, Expired }

#[near(serializers = [borsh, json])]
#[derive(Clone, Debug)]
pub struct Bid {
    pub seller: AccountId,
    pub ask: U128,
    pub state: BidState,
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
    pub awaiting: bool,
}

#[near(serializers = [borsh, json])]
#[derive(Clone, Copy, PartialEq, Debug)]
#[serde(rename_all = "snake_case")]
pub enum Payout { None, Pending, Sent, Failed }

#[near(serializers = [borsh, json])]
#[derive(Clone, Debug)]
pub struct Receipt {
    pub id: u32,
    pub job: u32,
    pub kind: String,
    pub seller: AccountId,
    pub price: U128,
    pub pass: bool,
    pub reason: String,
    pub delivery_hash: String,
    pub input_hash: String,
    pub signature: String,
    pub at_ms: u64,
    pub payout: Payout,
}

#[near(serializers = [borsh, json])]
#[derive(Clone, Debug)]
enum Inflight {
    Init,
    Check { job: u32, input_hash: String },
}

#[near(contract_state)]
#[derive(PanicOnDefault)]
pub struct Contract {
    beneficiary: AccountId,
    cap: u128,
    spent: u128,
    reserved: u128,
    outlayer: AccountId,
    wasm_hash: String,
    wasm_url: String,
    sign_pk: String,
    box_pk: String,
    sealed: String,
    ready: bool,
    inflight: Option<Inflight>,
    tee_error: String,
    hired_n: u32,
    jobs: Vector<Job>,
    receipts: Vector<Receipt>,
}

fn warden_only() { require!(env::predecessor_account_id() == env::current_account_id(), "Warden only"); }

fn last_result() -> Option<Vec<u8>> {
    env::promise_result_checked(0, 8192).ok()
}

fn hex_encode(bytes: &[u8]) -> String {
    const H: &[u8; 16] = b"0123456789abcdef";
    let mut s = String::with_capacity(bytes.len() * 2);
    for b in bytes {
        s.push(H[(b >> 4) as usize] as char);
        s.push(H[(b & 0xf) as usize] as char);
    }
    s
}

fn hex_byte(s: &str) -> Option<u8> {
    u8::from_str_radix(s, 16).ok()
}

fn hex_32(s: &str) -> Option<[u8; 32]> {
    if s.len() != 64 { return None; }
    let mut out = [0u8; 32];
    for i in 0..32 { out[i] = hex_byte(&s[i * 2..i * 2 + 2])?; }
    Some(out)
}

fn hex_64(s: &str) -> Option<[u8; 64]> {
    if s.len() != 128 { return None; }
    let mut out = [0u8; 64];
    for i in 0..64 { out[i] = hex_byte(&s[i * 2..i * 2 + 2])?; }
    Some(out)
}

fn sha256_hex(bytes: &[u8]) -> String { hex_encode(&env::sha256(bytes)) }

/// Same text as pop/tee/checker `verdict_message`.
fn verdict_message(job: u32, delivery: &str, input: &str, pass: bool, reason: &str) -> Option<Vec<u8>> {
    if hex_32(delivery).is_none() || hex_32(input).is_none() { return None; }
    if reason.len() > 180 || reason.chars().any(|c| c == '\n' || c == '\r') { return None; }
    Some(format!(
        "pop-tee/v1\njob:{job}\ndelivery:{delivery}\ninput:{input}\npass:{}\nreason:{reason}\n",
        u8::from(pass)
    ).into_bytes())
}

fn init_message(box_pk: &str) -> Option<Vec<u8>> {
    if hex_32(box_pk).is_none() { return None; }
    Some(format!("pop-tee/init\nbox:{box_pk}\n").into_bytes())
}

fn verify(message: &[u8], signature_hex: &str, public_hex: &str) -> bool {
    let (Some(sig), Some(pk)) = (hex_64(signature_hex), hex_32(public_hex)) else { return false };
    env::ed25519_verify(&sig, message, &pk)
}

fn guest_json(bytes: &[u8]) -> Option<Value> {
    let v: Value = serde_json::from_slice(bytes).ok()?;
    if let Some(s) = v.as_str() { serde_json::from_str(s).ok() } else { Some(v) }
}

fn valid_spec(kind: &str, spec: &str) -> Result<(), &'static str> {
    let v: Value = serde_json::from_str(spec).map_err(|_| "spec is not JSON")?;
    let u = |k: &str| v.get(k).and_then(|x| x.as_u64());
    match kind {
        "map" => {
            let (rooms, cols, rows) = (u("rooms").ok_or("spec.rooms")?, u("cols").ok_or("spec.cols")?, u("rows").ok_or("spec.rows")?);
            if !(2..=12).contains(&cols) || !(2..=12).contains(&rows) || rooms < 2 || rooms > cols * rows { return Err("map spec out of range"); }
        }
        "roster" => {
            let (lo, hi, size) = (u("lo").ok_or("spec.lo")?, u("hi").ok_or("spec.hi")?, u("size").ok_or("spec.size")?);
            if lo > hi || !(1..=12).contains(&size) || lo > size * 5 || hi < size { return Err("roster spec out of range"); }
        }
        "paint" => { let c = u("contrast_x100").ok_or("spec.contrast_x100")?; if !(100..=2100).contains(&c) { return Err("contrast out of range"); } }
        "tune" => {
            let bars = u("bars").ok_or("spec.bars")?;
            if !(1..=32).contains(&bars) { return Err("bars out of range"); }
            let key = v.get("key").and_then(|k| k.as_str()).unwrap_or("");
            if !matches!(key, "C major" | "A minor" | "G major" | "E minor") { return Err("unknown key"); }
        }
        _ => return Err("unknown kind"),
    }
    Ok(())
}

fn outlayer_call(outlayer: &AccountId, wasm_url: &str, wasm_hash: &str, input: &str, method: &str) -> Promise {
    let args = json!({
        "source": { "WasmUrl": { "url": wasm_url, "hash": wasm_hash, "build_target": "wasm32-wasip2" } },
        "input_data": input,
        "resource_limits": { "max_instructions": 200_000_000u64, "max_memory_mb": 64u32, "max_execution_seconds": 30u64 },
        "response_format": "Json",
    });
    Promise::new(outlayer.clone()).function_call(
        "request_execution",
        args.to_string().into_bytes(),
        env::attached_deposit(),
        GAS_CALL,
    ).then(Contract::ext(env::current_account_id()).with_static_gas(GAS_SETTLE).on_callback(method.to_string()))
}

#[near]
impl Contract {
    #[init]
    pub fn new(beneficiary: AccountId, cap: U128, outlayer: AccountId, wasm_hash: String, wasm_url: String) -> Self {
        warden_only();
        require!(cap.0 > 0, "cap must be above zero");
        require!(hex_32(&wasm_hash).is_some(), "wasm hash");
        require!(wasm_url.starts_with("https://") && wasm_url.len() <= 300, "wasm url");
        Self {
            beneficiary, cap: cap.0, spent: 0, reserved: 0, outlayer, wasm_hash, wasm_url,
            sign_pk: String::new(), box_pk: String::new(), sealed: String::new(), ready: false,
            inflight: None, tee_error: String::new(), hired_n: 0, jobs: Vector::new(b"j"), receipts: Vector::new(b"r"),
        }
    }

    /// Asks the TEE checker to seal a fresh box key and publish its signing key. Once.
    pub fn init_tee(&mut self, input: String) -> Promise {
        warden_only();
        require!(!self.ready && self.inflight.is_none(), "tee already set");
        require!(env::attached_deposit().as_yoctonear() >= MIN_CHECK_DEPOSIT, "attach 0.02 NEAR");
        require!(input == "{\"op\":\"init\"}", "input");
        self.inflight = Some(Inflight::Init);
        self.tee_error.clear();
        outlayer_call(&self.outlayer, &self.wasm_url, &self.wasm_hash, &input, "init")
    }

    pub fn post_job(&mut self, kind: String, title: String, spec: String, budget: U128, window_mins: u32) -> u32 {
        warden_only();
        require!(self.ready, "tee not ready");
        require!(title.len() <= 80 && spec.len() <= 512, "title or spec too long");
        if let Err(e) = valid_spec(&kind, &spec) { env::panic_str(e); }
        require!(budget.0 >= MIN_ASK, "budget too small");
        require!((5..=1440).contains(&window_mins), "window must be 5 to 1440 minutes");
        require!(self.spent + self.reserved + budget.0 <= self.cap, "over the cap");
        let storage = env::storage_byte_cost().as_yoctonear() * env::storage_usage() as u128;
        require!(env::account_balance().as_yoctonear() >= storage + self.reserved + budget.0 + STORAGE_BUFFER, "balance too low for this budget");
        self.reserved += budget.0;
        let id = self.jobs.len();
        self.jobs.push(Job {
            id, kind, title, spec, budget, window_ms: window_mins as u64 * 60_000, posted_ms: env::block_timestamp_ms(),
            state: JobState::Open, bids: Vec::new(), hired: None, price: U128(0), due_ms: 0, fails: 0, awaiting: false,
        });
        env::log_str(&format!("post_job {id}"));
        id
    }

    pub fn bid(&mut self, job_id: u32, ask: U128) -> u8 {
        let seller = env::predecessor_account_id();
        require!(seller != env::current_account_id(), "the Warden cannot bid");
        let job = self.job_mut(job_id);
        require!(job.state == JobState::Open && !job.awaiting, "job not open");
        require!(job.bids.len() < MAX_BIDS, "job has all its bids");
        require!(!job.bids.iter().any(|b| b.seller == seller), "one bid per seller");
        require!(ask.0 >= MIN_ASK && ask.0 <= job.budget.0, "ask must be 0.001 NEAR to the budget");
        job.bids.push(Bid { seller, ask, state: BidState::Open, at_ms: env::block_timestamp_ms() });
        (job.bids.len() - 1) as u8
    }

    pub fn hire(&mut self, job_id: u32, bid: u8) {
        warden_only();
        let now = env::block_timestamp_ms();
        let job = self.job_mut(job_id);
        require!(job.state == JobState::Open && !job.awaiting, "job not open");
        let b = job.bids.get_mut(bid as usize).unwrap_or_else(|| env::panic_str("no such bid"));
        require!(b.state == BidState::Open, "bid cannot be hired");
        require!(b.ask.0 <= job.budget.0, "price over budget");
        b.state = BidState::Hired;
        let price = b.ask;
        job.hired = Some(bid);
        job.price = price;
        job.due_ms = now + job.window_ms;
        job.state = JobState::Hired;
        self.hired_n += 1;
    }

    pub fn cancel_job(&mut self, job_id: u32) {
        warden_only();
        let job = self.job_mut(job_id);
        require!(job.state == JobState::Open && !job.awaiting, "only an open job can be cancelled");
        job.state = JobState::Cancelled;
        self.reserved -= job.budget.0;
    }

    /// The hired seller submits a ciphertext. The checker opens it. This contract stores the hash, not the delivery.
    pub fn deliver(&mut self, job_id: u32, box_b64: String) -> Promise {
        let seller = env::predecessor_account_id();
        require!(self.ready && self.inflight.is_none(), "checker is busy");
        require!(env::attached_deposit().as_yoctonear() >= MIN_CHECK_DEPOSIT, "attach 0.02 NEAR");
        require!(box_b64.len() <= 8000 && box_b64.chars().all(|c| c.is_ascii()), "box");
        let now = env::block_timestamp_ms();
        let job = self.jobs.get(job_id).cloned().unwrap_or_else(|| env::panic_str("no such job"));
        require!(job.state == JobState::Hired && !job.awaiting, "nobody is hired");
        let b = &job.bids[job.hired.unwrap() as usize];
        require!(b.seller == seller, "only the hired seller delivers");
        require!(now <= job.due_ms, "window closed; call expire");
        let input = json!({
            "op": "check",
            "job": job_id,
            "kind": job.kind,
            "spec": job.spec,
            "sealed": self.sealed,
            "box": box_b64,
            "box_pk": self.box_pk,
        }).to_string();
        let input_hash = sha256_hex(input.as_bytes());
        self.jobs.get_mut(job_id).unwrap().awaiting = true;
        self.inflight = Some(Inflight::Check { job: job_id, input_hash });
        self.tee_error.clear();
        env::log_str(&format!("tee deliver job {job_id}"));
        outlayer_call(&self.outlayer, &self.wasm_url, &self.wasm_hash, &input, "check")
    }

    pub fn expire(&mut self, job_id: u32) {
        let now = env::block_timestamp_ms();
        let job = self.job_mut(job_id);
        require!(job.state == JobState::Hired && !job.awaiting && now > job.due_ms, "not overdue");
        let bi = job.hired.unwrap() as usize;
        job.bids[bi].state = BidState::Expired;
        job.hired = None;
        job.state = JobState::Open;
        self.hired_n -= 1;
    }

    pub fn close(&mut self) -> Promise {
        require!(env::predecessor_account_id() == self.beneficiary, "beneficiary only");
        require!(self.hired_n == 0 && self.inflight.is_none(), "a seller is hired");
        Promise::new(env::current_account_id()).delete_account(self.beneficiary.clone())
    }

    /// One callback for both TEE calls. `which` is fixed by the contract when it starts the call.
    #[private]
    pub fn on_callback(&mut self, which: String) -> Option<Promise> {
        let bytes = last_result();
        if which == "init" { self.settle_init(bytes); None } else { self.settle_check(bytes) }
    }

    #[private]
    pub fn on_paid(&mut self, rid: u32) {
        let rc = self.receipts.get_mut(rid).unwrap();
        rc.payout = if last_result().is_some() { Payout::Sent } else { Payout::Failed };
        env::log_str(&format!("payout receipt {rid}: {:?}", rc.payout));
    }

    pub fn get_config(&self) -> Value {
        json!({
            "beneficiary": self.beneficiary, "cap": U128(self.cap), "spent": U128(self.spent), "reserved": U128(self.reserved),
            "outlayer": self.outlayer, "ready": self.ready, "inflight": self.inflight.is_some(), "tee_error": self.tee_error,
            "jobs": self.jobs.len(), "receipts": self.receipts.len(), "hired": self.hired_n,
            "balance": U128(env::account_balance().as_yoctonear()),
        })
    }

    pub fn get_tee(&self) -> Value {
        json!({
            "ready": self.ready, "wasm_hash": self.wasm_hash, "wasm_url": self.wasm_url,
            "sign_pk": self.sign_pk, "box_pk": self.box_pk, "sealed": self.sealed, "tee_error": self.tee_error,
        })
    }

    pub fn get_job(&self, job_id: u32) -> Option<Job> { self.jobs.get(job_id).cloned() }
    pub fn get_receipts(&self, from: Option<u32>, limit: Option<u32>) -> Vec<Receipt> {
        let from = from.unwrap_or(0);
        (from..self.receipts.len()).take(limit.unwrap_or(20).min(50) as usize).map(|i| self.receipts[i].clone()).collect()
    }

    fn settle_init(&mut self, bytes: Option<Vec<u8>>) {
        if !matches!(self.inflight, Some(Inflight::Init)) { self.tee_error = "no init in flight".into(); return; }
        self.inflight = None;
        let Some(bytes) = bytes else { self.tee_error = "checker did not answer".into(); return; };
        let Some(v) = guest_json(&bytes) else { self.tee_error = "checker answer is not JSON".into(); return; };
        if v.get("op").and_then(|x| x.as_str()) != Some("init") {
            self.tee_error = format!("init refused: {}", v.get("reason").and_then(|r| r.as_str()).unwrap_or("bad answer"));
            return;
        }
        let (Some(sign_pk), Some(box_pk), Some(sealed), Some(signature)) = (
            v.get("sign_pk").and_then(|x| x.as_str()),
            v.get("box_pk").and_then(|x| x.as_str()),
            v.get("sealed").and_then(|x| x.as_str()),
            v.get("signature").and_then(|x| x.as_str()),
        ) else { self.tee_error = "init fields".into(); return; };
        if sealed.len() > 512 || sealed.is_empty() { self.tee_error = "sealed".into(); return; }
        let Some(message) = init_message(box_pk) else { self.tee_error = "box key".into(); return; };
        if !verify(&message, signature, sign_pk) { self.tee_error = "init signature".into(); return; }
        self.sign_pk = sign_pk.to_string();
        self.box_pk = box_pk.to_string();
        self.sealed = sealed.to_string();
        self.ready = true;
        self.tee_error.clear();
        env::log_str(&format!("tee ready {sign_pk}"));
    }

    fn settle_check(&mut self, bytes: Option<Vec<u8>>) -> Option<Promise> {
        let Some(Inflight::Check { job, input_hash }) = self.inflight.take() else {
            self.tee_error = "no check in flight".into();
            return None;
        };
        let clear = |this: &mut Self, job: u32| { if let Some(j) = this.jobs.get_mut(job) { j.awaiting = false; } };
        let Some(bytes) = bytes else {
            clear(self, job);
            self.tee_error = "checker did not answer".into();
            return None;
        };
        let Some(v) = guest_json(&bytes) else {
            clear(self, job);
            self.tee_error = "checker answer is not JSON".into();
            return None;
        };
        if v.get("op").and_then(|x| x.as_str()) != Some("check") {
            clear(self, job);
            self.tee_error = format!("check refused: {}", v.get("reason").and_then(|r| r.as_str()).unwrap_or("bad answer"));
            return None;
        }
        let pass = v.get("pass").and_then(|x| x.as_bool());
        let reason = v.get("reason").and_then(|x| x.as_str()).unwrap_or("");
        let delivery = v.get("delivery").and_then(|x| x.as_str()).unwrap_or("");
        let input = v.get("input").and_then(|x| x.as_str()).unwrap_or("");
        let signature = v.get("signature").and_then(|x| x.as_str()).unwrap_or("");
        let sign_pk = v.get("sign_pk").and_then(|x| x.as_str()).unwrap_or("");
        let job_back = v.get("job").and_then(|x| x.as_u64());
        let Some(message) = verdict_message(job, delivery, input, pass.unwrap_or(false), reason) else {
            clear(self, job);
            self.tee_error = "verdict fields".into();
            return None;
        };
        let why = if job_back != Some(job as u64) { "job mismatch" }
            else if sign_pk != self.sign_pk { "signing key mismatch" }
            else if input != input_hash { "input hash mismatch" }
            else if pass.is_none() { "verdict fields" }
            else if !verify(&message, signature, &self.sign_pk) { "bad signature" }
            else { "" };
        if !why.is_empty() {
            clear(self, job);
            self.tee_error = why.into();
            env::log_str(&format!("tee reject job {job}: {why}"));
            return None;
        }
        let pass = pass.unwrap();
        self.finish_job(job, pass, reason, delivery, input, signature)
    }

    fn finish_job(&mut self, job_id: u32, pass: bool, reason: &str, delivery: &str, input: &str, signature: &str) -> Option<Promise> {
        let now = env::block_timestamp_ms();
        let job = self.jobs.get(job_id).cloned().unwrap();
        let bi = job.hired.unwrap() as usize;
        let seller = job.bids[bi].seller.clone();
        let price = job.price;
        let rid = self.receipts.len();
        self.receipts.push(Receipt {
            id: rid, job: job_id, kind: job.kind.clone(), seller: seller.clone(), price, pass, reason: reason.to_string(),
            delivery_hash: delivery.to_string(), input_hash: input.to_string(), signature: signature.to_string(), at_ms: now,
            payout: if pass { Payout::Pending } else { Payout::None },
        });
        self.hired_n -= 1;
        let j = self.jobs.get_mut(job_id).unwrap();
        j.awaiting = false;
        if pass {
            j.bids[bi].state = BidState::Passed;
            j.state = JobState::Done;
            self.reserved -= j.budget.0;
            self.spent += price.0;
            env::log_str(&format!("tee pass job {job_id} receipt {rid}: {reason}"));
            let me = Self::ext(env::current_account_id()).with_static_gas(GAS_PAID);
            Some(Promise::new(seller).transfer(NearToken::from_yoctonear(price.0)).then(me.on_paid(rid)))
        } else {
            j.bids[bi].state = BidState::Failed;
            j.fails += 1;
            j.hired = None;
            if j.fails >= MAX_FAILS { j.state = JobState::Closed; self.reserved -= j.budget.0; } else { j.state = JobState::Open; }
            env::log_str(&format!("tee fail job {job_id} receipt {rid}: {reason}"));
            None
        }
    }

    fn job_mut(&mut self, id: u32) -> &mut Job { self.jobs.get_mut(id).unwrap_or_else(|| env::panic_str("no such job")) }
}

#[cfg(test)]
mod tests;
