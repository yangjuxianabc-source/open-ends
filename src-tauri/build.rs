use aes_gcm::{
    aead::{Aead, KeyInit},
    Aes256Gcm, Nonce,
};
use sha2::{Digest, Sha256};
use std::{env, fs, path::PathBuf};

const GOOGLE_BOOKS_ENV: &str = "GOOGLE_BOOKS_API_KEY";
const WRAPPING_KEY_MATERIAL: &[u8] = b"Open Ends|io.github.yangjuxianabc.openends|google-books|v1";

fn main() {
    tauri_build::build();

    let manifest_dir = PathBuf::from(env::var("CARGO_MANIFEST_DIR").expect("CARGO_MANIFEST_DIR"));
    let env_path = manifest_dir.join("..").join(".env.local");
    println!("cargo:rerun-if-changed={}", env_path.display());
    println!("cargo:rerun-if-env-changed={}", GOOGLE_BOOKS_ENV);

    let api_key = read_google_books_api_key(&env_path);

    let output_path =
        PathBuf::from(env::var("OUT_DIR").expect("OUT_DIR")).join("google_books_secret.rs");
    let generated = api_key.as_deref().map(encrypt_secret).unwrap_or_else(|| {
        "pub const GOOGLE_BOOKS_SECRET: Option<(&[u8], &[u8])> = None;\n".to_owned()
    });
    fs::write(output_path, generated).expect("write generated Google Books secret");
}

fn read_google_books_api_key(env_path: &PathBuf) -> Option<String> {
    env::var(GOOGLE_BOOKS_ENV)
        .ok()
        .and_then(normalize_api_key)
        .or_else(|| {
            dotenvy::from_path_iter(env_path).ok().and_then(|entries| {
                entries
                    .filter_map(Result::ok)
                    .find_map(|(name, value)| (name == GOOGLE_BOOKS_ENV).then_some(value))
                    .and_then(normalize_api_key)
            })
        })
}

fn normalize_api_key(value: String) -> Option<String> {
    let value = value.trim().to_owned();
    (!value.is_empty()).then_some(value)
}

fn encrypt_secret(value: &str) -> String {
    let wrapping_key = Sha256::digest(WRAPPING_KEY_MATERIAL);
    let cipher = Aes256Gcm::new_from_slice(&wrapping_key).expect("valid AES-256 key");
    let nonce_digest =
        Sha256::digest([WRAPPING_KEY_MATERIAL, b"|nonce|", value.as_bytes()].concat());
    let nonce = &nonce_digest[..12];
    let ciphertext = cipher
        .encrypt(Nonce::from_slice(nonce), value.as_bytes())
        .expect("encrypt Google Books API key");
    format!(
        "pub const GOOGLE_BOOKS_SECRET: Option<(&[u8], &[u8])> = Some((&{:?}, &{:?}));\n",
        nonce, ciphertext
    )
}
