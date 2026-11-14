//! Message bytes and the delivery box for the TEE checker.
//! The guest signs `verdict_message` and `init_message`. The testnet contract checks the same bytes.
use chacha20poly1305::aead::{Aead, KeyInit};
use chacha20poly1305::{XChaCha20Poly1305, XNonce};
use sha2::{Digest, Sha256};
use x25519_dalek::{PublicKey, StaticSecret};

pub mod checks;

pub const BOX_VERSION: u8 = 1;
pub const AAD: &[u8] = b"pop-tee-box-v1";

pub fn sha256(bytes: &[u8]) -> [u8; 32] {
    Sha256::digest(bytes).into()
}

pub fn hex32(bytes: &[u8; 32]) -> String {
    hex::encode(bytes)
}

/// Canonical text the TEE signs for a verdict. Lowercase hex, one trailing newline, no newline inside `reason`.
pub fn verdict_message(job: u32, delivery_hex: &str, input_hex: &str, pass: bool, reason: &str) -> Result<String, &'static str> {
    if delivery_hex.len() != 64 || input_hex.len() != 64 { return Err("hash length"); }
    if !delivery_hex.chars().all(|c| c.is_ascii_hexdigit()) || !input_hex.chars().all(|c| c.is_ascii_hexdigit()) {
        return Err("hash hex");
    }
    if reason.len() > 180 || reason.chars().any(|c| c == '\n' || c == '\r') { return Err("reason"); }
    Ok(format!(
        "pop-tee/v1\njob:{job}\ndelivery:{}\ninput:{}\npass:{}\nreason:{reason}\n",
        delivery_hex.to_ascii_lowercase(),
        input_hex.to_ascii_lowercase(),
        u8::from(pass),
    ))
}

pub fn init_message(box_hex: &str) -> Result<String, &'static str> {
    if box_hex.len() != 64 || !box_hex.chars().all(|c| c.is_ascii_hexdigit()) { return Err("box key"); }
    Ok(format!("pop-tee/init\nbox:{}\n", box_hex.to_ascii_lowercase()))
}

pub fn public_from_secret(secret: &[u8; 32]) -> [u8; 32] {
    PublicKey::from(&StaticSecret::from(*secret)).to_bytes()
}

/// `1 || ephemeral public (32) || nonce (24) || ciphertext || tag`.
pub fn seal(recipient: &[u8; 32], ephemeral_secret: &[u8; 32], nonce: &[u8; 24], plaintext: &[u8]) -> Result<Vec<u8>, &'static str> {
    let shared = StaticSecret::from(*ephemeral_secret).diffie_hellman(&PublicKey::from(*recipient));
    if shared.as_bytes().iter().all(|b| *b == 0) { return Err("shared secret"); }
    let cipher = XChaCha20Poly1305::new(shared.as_bytes().into());
    let nonce = XNonce::from_slice(nonce);
    let ct = cipher.encrypt(nonce, plaintext).map_err(|_| "seal")?;
    let epk = public_from_secret(ephemeral_secret);
    let mut out = Vec::with_capacity(1 + 32 + 24 + ct.len());
    out.push(BOX_VERSION);
    out.extend_from_slice(&epk);
    out.extend_from_slice(nonce);
    out.extend_from_slice(&ct);
    Ok(out)
}

pub fn open(secret: &[u8; 32], blob: &[u8]) -> Result<Vec<u8>, &'static str> {
    if blob.len() < 1 + 32 + 24 + 16 || blob[0] != BOX_VERSION { return Err("bad box"); }
    let mut epk = [0u8; 32];
    let mut nonce = [0u8; 24];
    epk.copy_from_slice(&blob[1..33]);
    nonce.copy_from_slice(&blob[33..57]);
    let shared = StaticSecret::from(*secret).diffie_hellman(&PublicKey::from(epk));
    let cipher = XChaCha20Poly1305::new(shared.as_bytes().into());
    cipher.decrypt(XNonce::from_slice(&nonce), &blob[57..]).map_err(|_| "box failed")
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::checks::{check, valid_spec};
    use serde_json::json;

    const GOOD_MAP: &str = r#"{"rooms":[[0,0],[1,0],[1,1]],"links":[[[0,0],[1,0]],[[1,0],[1,1]]],"entry":[0,0],"exit":[1,1]}"#;
    const CUT_MAP: &str = r#"{"rooms":[[0,0],[1,0],[3,2]],"links":[[[0,0],[1,0]]],"entry":[0,0],"exit":[1,0]}"#;

    #[test]
    fn message_matches_the_documented_lines() {
        let delivery = hex32(&sha256(b"hello"));
        assert_eq!(delivery, "2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824");
        let text = verdict_message(7, &delivery, &"ab".repeat(32), true, "ok").unwrap();
        assert_eq!(
            text,
            "pop-tee/v1\njob:7\ndelivery:2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824\ninput:abababababababababababababababababababababababababababababababab\npass:1\nreason:ok\n"
        );
        assert!(verdict_message(1, &delivery, &"ab".repeat(32), true, "a\nb").is_err());
    }

    #[test]
    fn box_roundtrip_and_a_wrong_key_fails() {
        let secret = [7u8; 32];
        let eph = [9u8; 32];
        let nonce = [3u8; 24];
        let pk = public_from_secret(&secret);
        let blob = seal(&pk, &eph, &nonce, b"{\"rooms\":[]}").unwrap();
        assert_eq!(open(&secret, &blob).unwrap(), b"{\"rooms\":[]}");
        let mut wrong = secret;
        wrong[1] ^= 0x08; // a bit X25519 clamping does not clear
        assert!(open(&wrong, &blob).is_err());
        let pinned_pk = public_from_secret(&secret);
        let pinned = seal(&pinned_pk, &eph, &nonce, b"hello").unwrap();
        assert_eq!(hex::encode(pinned_pk), "13be4feaeaf204c7fd3358fc9c00721881d174278128227ec674f37f7fe97b6d");
        assert_eq!(hex::encode(pinned), "0157db4b359f23ae5e146e4e2512056704722506348c150c14753d0c933d04d421030303030303030303030303030303030303030303030303d508bf26629801c8a73f296a923a23c000af5302d6");
    }

    #[test]
    fn map_rules_match_the_escrow() {
        let spec = json!({"rooms": 3, "cols": 4, "rows": 3});
        assert!(valid_spec("map", &spec).is_ok());
        let good: serde_json::Value = serde_json::from_str(GOOD_MAP).unwrap();
        let cut: serde_json::Value = serde_json::from_str(CUT_MAP).unwrap();
        assert!(check("map", &spec, &good).pass);
        assert_eq!(check("map", &spec, &cut).reason, "room cut off");
    }
}
