use aes_gcm::{
    aead::{Aead, KeyInit},
    Aes256Gcm, Nonce,
};
use chrono::Utc;
use keyring::{Entry, Error as KeyringError};
use serde::Serialize;
use serde_json::json;
use sha2::{Digest, Sha256};
use tauri::{AppHandle, Emitter};

const SERVICE: &str = "io.github.yangjuxianabc.openends";
const WRAPPING_KEY_MATERIAL: &[u8] = b"Open Ends|io.github.yangjuxianabc.openends|google-books|v1";

mod embedded_google_books {
    include!(concat!(env!("OUT_DIR"), "/google_books_secret.rs"));
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CredentialStatus {
    configured: bool,
    verification: Option<String>,
    updated_at: Option<String>,
    model: Option<String>,
}

fn account(kind: &str) -> Result<&'static str, String> {
    match kind {
        "deepseek" => Ok("deepseek-api-key"),
        "tmdb" => Ok("tmdb-api-key"),
        _ => Err("CREDENTIAL_KIND_NOT_ALLOWED".into()),
    }
}

fn entry(kind: &str) -> Result<Entry, String> {
    Entry::new(SERVICE, account(kind)?).map_err(|error| error.to_string())
}

fn credential_metadata(verification: &str) -> serde_json::Value {
    json!({"verification":verification,"updatedAt":Utc::now().to_rfc3339()})
}

pub(crate) fn read_secret(kind: &str) -> Result<String, String> {
    entry(kind)?.get_password().map_err(|error| match error {
        KeyringError::NoEntry => "CREDENTIAL_NOT_CONFIGURED".into(),
        other => other.to_string(),
    })
}

pub(crate) fn read_builtin_google_books_key() -> Option<String> {
    let (nonce, ciphertext) = embedded_google_books::GOOGLE_BOOKS_SECRET?;
    let wrapping_key = Sha256::digest(WRAPPING_KEY_MATERIAL);
    let cipher = Aes256Gcm::new_from_slice(&wrapping_key).ok()?;
    let plaintext = cipher.decrypt(Nonce::from_slice(nonce), ciphertext).ok()?;
    String::from_utf8(plaintext)
        .ok()
        .filter(|value| !value.trim().is_empty())
}

#[tauri::command]
pub fn credential_status(app: AppHandle, kind: String) -> Result<CredentialStatus, String> {
    let configured = match entry(&kind)?.get_password() {
        Ok(_) => true,
        Err(KeyringError::NoEntry) => false,
        Err(error) => return Err(error.to_string()),
    };
    let metadata = crate::read_app_setting(&app, &format!("credential.{kind}.metadata"))
        .and_then(|value| serde_json::from_str::<serde_json::Value>(&value).ok());
    Ok(CredentialStatus {
        configured,
        verification: metadata
            .as_ref()
            .and_then(|value| value.get("verification"))
            .and_then(|value| value.as_str())
            .map(str::to_owned),
        updated_at: metadata
            .as_ref()
            .and_then(|value| value.get("updatedAt"))
            .and_then(|value| value.as_str())
            .map(str::to_owned),
        model: (kind == "deepseek")
            .then(|| crate::transport::DEFAULT_DEEPSEEK_MODEL.into()),
    })
}

#[tauri::command]
pub async fn save_credential(
    app: AppHandle,
    kind: String,
    value: String,
) -> Result<CredentialStatus, String> {
    let value = value.trim();
    if value.is_empty() {
        return Err("CREDENTIAL_EMPTY".into());
    }
    let verification = if kind == "deepseek" {
        crate::transport::validate_deepseek_key(value).await?
    } else {
        account(&kind)?;
        "unverified".into()
    };
    entry(&kind)?
        .set_password(value)
        .map_err(|error| error.to_string())?;
    crate::write_app_setting(
        &app,
        &format!("credential.{kind}.metadata"),
        &credential_metadata(&verification).to_string(),
    )?;
    let _ = app.emit("open-ends:store-changed", json!({"origin":"rust"}));
    credential_status(app, kind)
}

#[tauri::command]
pub fn delete_credential(app: AppHandle, kind: String) -> Result<CredentialStatus, String> {
    match entry(&kind)?.delete_credential() {
        Ok(()) | Err(KeyringError::NoEntry) => {}
        Err(error) => return Err(error.to_string()),
    }
    crate::delete_app_setting(&app, &format!("credential.{kind}.metadata"))?;
    let _ = app.emit("open-ends:store-changed", json!({"origin":"rust"}));
    credential_status(app, kind)
}

#[cfg(test)]
mod tests {
    use super::{account, credential_metadata, read_builtin_google_books_key};

    #[test]
    fn credential_kinds_are_allowlisted() {
        assert_eq!(account("deepseek").unwrap(), "deepseek-api-key");
        assert_eq!(account("tmdb").unwrap(), "tmdb-api-key");
        assert_eq!(account("other").unwrap_err(), "CREDENTIAL_KIND_NOT_ALLOWED");
    }

    #[test]
    fn credential_metadata_includes_utc_update_time() {
        let metadata = credential_metadata("verified");
        assert_eq!(
            metadata
                .get("verification")
                .and_then(|value| value.as_str()),
            Some("verified")
        );
        let updated_at = metadata
            .get("updatedAt")
            .and_then(|value| value.as_str())
            .unwrap();
        assert!(chrono::DateTime::parse_from_rfc3339(updated_at).is_ok());
    }

    #[test]
    fn built_in_google_books_secret_is_optional_and_decrypts_when_present() {
        if let Some(value) = read_builtin_google_books_key() {
            assert!(value.len() >= 20);
        }
    }
}
