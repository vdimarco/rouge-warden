//! OutLayer guest. Reads one JSON object on stdin and writes one JSON object on stdout.
//! `init` seals a fresh X25519 key with the host encryption key and signs the public key.
//! `check` opens that seal, opens the seller's box, runs the check, and signs the verdict.
//! The delivery plaintext is not written out.
use base64::Engine;
use pop_tee_checker::{checks, init_message, open, public_from_secret, sha256, verdict_message, AAD};
use serde_json::{json, Value};
use std::io::{self, Read, Write};

mod host {
    wit_bindgen::generate!({
        world: "checker",
        path: "wit",
        generate_all,
    });
}
use host::outlayer::encryption_keys::api as enc;
use host::outlayer::signing_keys::api as sign;

#[used]
#[link_section = "outlayer.manifest"]
static OUTLAYER_MANIFEST: [u8; include_bytes!("../manifest.json").len()] = *include_bytes!("../manifest.json");

fn host_sign(message: &[u8]) -> Result<(Vec<u8>, Vec<u8>), String> {
    let pk = sign::public_key("verdict", None)?;
    let sig = sign::sign("verdict", None, message)?;
    if pk.len() != 32 || sig.len() != 64 { return Err("signing key".into()); }
    Ok((pk, sig))
}

fn init() -> Result<Value, String> {
    let mut seed = [0u8; 32];
    getrandom::getrandom(&mut seed).map_err(|e| e.to_string())?;
    let secret = x25519_dalek::StaticSecret::from(seed).to_bytes();
    seed.fill(0);
    std::hint::black_box(seed);
    let box_pk = public_from_secret(&secret);
    let sealed = enc::encrypt("box", None, &secret, AAD)?;
    let box_hex = hex::encode(box_pk);
    let msg = init_message(&box_hex).map_err(|e| e.to_string())?;
    let (sign_pk, sig) = host_sign(msg.as_bytes())?;
    Ok(json!({
        "op": "init",
        "sign_pk": hex::encode(sign_pk),
        "box_pk": box_hex,
        "sealed": base64::engine::general_purpose::STANDARD.encode(sealed),
        "signature": hex::encode(sig),
    }))
}

fn check(input: &Value, stdin: &[u8]) -> Result<Value, String> {
    let job = input.get("job").and_then(|v| v.as_u64()).ok_or("job")? as u32;
    let kind = input.get("kind").and_then(|v| v.as_str()).ok_or("kind")?;
    let spec_s = input.get("spec").and_then(|v| v.as_str()).ok_or("spec")?;
    let sealed_b64 = input.get("sealed").and_then(|v| v.as_str()).ok_or("sealed")?;
    let box_b64 = input.get("box").and_then(|v| v.as_str()).ok_or("box")?;
    let expect_pk = input.get("box_pk").and_then(|v| v.as_str()).ok_or("box_pk")?;
    let sealed = base64::engine::general_purpose::STANDARD.decode(sealed_b64).map_err(|_| "sealed".to_string())?;
    let blob = base64::engine::general_purpose::STANDARD.decode(box_b64).map_err(|_| "box".to_string())?;
    let secret = enc::decrypt("box", None, &sealed, AAD)?;
    if secret.len() != 32 { return Err("sealed key".into()); }
    let mut sk = [0u8; 32];
    sk.copy_from_slice(&secret);
    let got_pk = hex::encode(public_from_secret(&sk));
    if got_pk != expect_pk.to_ascii_lowercase() { return Err("sealed key does not match".into()); }
    let plain = open(&sk, &blob).map_err(|e| e.to_string())?;
    sk.fill(0);
    std::hint::black_box(sk);
    let delivery = sha256(&plain);
    let input_hash = sha256(stdin);
    let spec: Value = serde_json::from_str(spec_s).map_err(|_| "spec is not JSON".to_string())?;
    let verdict = match serde_json::from_slice::<Value>(&plain) {
        Ok(data) => checks::check(kind, &spec, &data),
        Err(_) => checks::Verdict { pass: false, reason: "delivery is not JSON".into() },
    };
    let delivery_hex = hex::encode(delivery);
    let input_hex = hex::encode(input_hash);
    let msg = verdict_message(job, &delivery_hex, &input_hex, verdict.pass, &verdict.reason).map_err(|e| e.to_string())?;
    let (sign_pk, sig) = host_sign(msg.as_bytes())?;
    Ok(json!({
        "op": "check",
        "job": job,
        "pass": verdict.pass,
        "reason": verdict.reason,
        "delivery": delivery_hex,
        "input": input_hex,
        "sign_pk": hex::encode(sign_pk),
        "signature": hex::encode(sig),
    }))
}

fn main() {
    let mut raw = String::new();
    if io::stdin().read_to_string(&mut raw).is_err() {
        finish(Err("stdin".into()));
        return;
    }
    let body = raw.trim();
    let parsed: Result<Value, _> = serde_json::from_str(body);
    let out = match parsed {
        Err(_) => Err("input is not JSON".into()),
        Ok(v) => match v.get("op").and_then(|op| op.as_str()) {
            Some("init") => init(),
            // Hash the JSON text. A trailing newline from the worker does not change it.
            Some("check") => check(&v, body.as_bytes()),
            _ => Err("op".into()),
        },
    };
    finish(out);
}

fn finish(out: Result<Value, String>) {
    let body = match out {
        Ok(v) => v,
        Err(reason) => json!({"op": "error", "reason": reason}),
    };
    print!("{}", body);
    let _ = io::stdout().flush();
}
