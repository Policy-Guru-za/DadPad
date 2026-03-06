use aes_gcm::aead::{Aead, KeyInit};
use aes_gcm::{Aes256Gcm, Nonce};
use rand::rngs::OsRng;
use rand::RngCore;
use serde::{Deserialize, Serialize};
use std::fmt::{Display, Formatter};
use std::fs::{self, OpenOptions};
use std::io::Write;
#[cfg(unix)]
use std::os::unix::fs::{DirBuilderExt, OpenOptionsExt};
use std::path::{Path, PathBuf};

const APP_DIRECTORY_NAME: &str = ".polishpad";
const KEY_FILE_NAME: &str = "encryption.key";
const CONFIG_FILE_NAME: &str = "config.enc";
const KEY_LENGTH_BYTES: usize = 32;
const NONCE_LENGTH_BYTES: usize = 12;
const DEFAULT_MODEL: &str = "gpt-5-nano-2025-08-07";

fn default_true() -> bool {
    true
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct AppConfig {
    pub openai_api_key: String,
    pub model: String,
    pub temperature: f64,
    pub streaming: bool,
    pub token_protection: bool,
    #[serde(default = "default_true")]
    pub smart_structuring: bool,
}

impl Default for AppConfig {
    fn default() -> Self {
        Self {
            openai_api_key: String::new(),
            model: DEFAULT_MODEL.to_string(),
            temperature: 0.2,
            streaming: true,
            token_protection: true,
            smart_structuring: true,
        }
    }
}

#[derive(Debug)]
enum ConfigError {
    Io(std::io::Error),
    Serde(serde_json::Error),
    Crypto(&'static str),
    HomeDirectoryMissing,
}

impl Display for ConfigError {
    fn fmt(&self, formatter: &mut Formatter<'_>) -> std::fmt::Result {
        match self {
            Self::Io(error) => write!(formatter, "I/O error: {error}"),
            Self::Serde(error) => write!(formatter, "Serialization error: {error}"),
            Self::Crypto(message) => write!(formatter, "{message}"),
            Self::HomeDirectoryMissing => write!(formatter, "Could not resolve HOME directory."),
        }
    }
}

impl From<std::io::Error> for ConfigError {
    fn from(value: std::io::Error) -> Self {
        Self::Io(value)
    }
}

impl From<serde_json::Error> for ConfigError {
    fn from(value: serde_json::Error) -> Self {
        Self::Serde(value)
    }
}

fn normalize_config(config: AppConfig) -> AppConfig {
    let model = if config.model.trim().is_empty() {
        DEFAULT_MODEL.to_string()
    } else {
        config.model.trim().to_string()
    };

    let temperature = if config.temperature.is_finite() {
        config.temperature.clamp(0.0, 2.0)
    } else {
        0.2
    };

    AppConfig {
        openai_api_key: config.openai_api_key.trim().to_string(),
        model,
        temperature,
        streaming: config.streaming,
        token_protection: config.token_protection,
        smart_structuring: config.smart_structuring,
    }
}

fn resolve_app_directory() -> Result<PathBuf, ConfigError> {
    let home = std::env::var_os("HOME").ok_or(ConfigError::HomeDirectoryMissing)?;
    Ok(PathBuf::from(home).join(APP_DIRECTORY_NAME))
}

fn ensure_directory(path: &Path) -> Result<(), ConfigError> {
    if path.exists() {
        return Ok(());
    }

    #[cfg(unix)]
    {
        let mut builder = fs::DirBuilder::new();
        builder.recursive(true);
        builder.mode(0o700);
        builder.create(path)?;
        return Ok(());
    }

    #[cfg(not(unix))]
    {
        fs::create_dir_all(path)?;
        Ok(())
    }
}

fn open_new_private_file(path: &Path) -> Result<std::fs::File, ConfigError> {
    let mut options = OpenOptions::new();
    options.write(true).create_new(true);
    #[cfg(unix)]
    {
        options.mode(0o600);
    }
    Ok(options.open(path)?)
}

fn key_path(base_dir: &Path) -> PathBuf {
    base_dir.join(KEY_FILE_NAME)
}

fn config_path(base_dir: &Path) -> PathBuf {
    base_dir.join(CONFIG_FILE_NAME)
}

fn load_or_create_key(base_dir: &Path) -> Result<[u8; KEY_LENGTH_BYTES], ConfigError> {
    ensure_directory(base_dir)?;

    let path = key_path(base_dir);
    if path.exists() {
        let key = fs::read(path)?;
        if key.len() != KEY_LENGTH_BYTES {
            return Err(ConfigError::Crypto("Invalid encryption key length."));
        }

        let mut key_bytes = [0_u8; KEY_LENGTH_BYTES];
        key_bytes.copy_from_slice(&key);
        return Ok(key_bytes);
    }

    let mut key_bytes = [0_u8; KEY_LENGTH_BYTES];
    OsRng.fill_bytes(&mut key_bytes);

    match open_new_private_file(&path) {
        Ok(mut file) => {
            file.write_all(&key_bytes)?;
            file.sync_all()?;
            Ok(key_bytes)
        }
        Err(ConfigError::Io(error)) if error.kind() == std::io::ErrorKind::AlreadyExists => {
            load_or_create_key(base_dir)
        }
        Err(other) => Err(other),
    }
}

fn encrypt_config(config: &AppConfig, key_bytes: &[u8; KEY_LENGTH_BYTES]) -> Result<Vec<u8>, ConfigError> {
    let plaintext = serde_json::to_vec(config)?;
    let cipher = Aes256Gcm::new_from_slice(key_bytes)
        .map_err(|_| ConfigError::Crypto("Invalid encryption key material."))?;

    let mut nonce_bytes = [0_u8; NONCE_LENGTH_BYTES];
    OsRng.fill_bytes(&mut nonce_bytes);

    let ciphertext = cipher
        .encrypt(Nonce::from_slice(&nonce_bytes), plaintext.as_ref())
        .map_err(|_| ConfigError::Crypto("Failed to encrypt config."))?;

    let mut payload = Vec::with_capacity(NONCE_LENGTH_BYTES + ciphertext.len());
    payload.extend_from_slice(&nonce_bytes);
    payload.extend_from_slice(&ciphertext);
    Ok(payload)
}

fn decrypt_config(payload: &[u8], key_bytes: &[u8; KEY_LENGTH_BYTES]) -> Result<AppConfig, ConfigError> {
    if payload.len() <= NONCE_LENGTH_BYTES {
        return Err(ConfigError::Crypto("Encrypted config payload is invalid."));
    }

    let nonce = &payload[..NONCE_LENGTH_BYTES];
    let ciphertext = &payload[NONCE_LENGTH_BYTES..];

    let cipher = Aes256Gcm::new_from_slice(key_bytes)
        .map_err(|_| ConfigError::Crypto("Invalid encryption key material."))?;
    let plaintext = cipher
        .decrypt(Nonce::from_slice(nonce), ciphertext)
        .map_err(|_| ConfigError::Crypto("Failed to decrypt config."))?;

    let parsed: AppConfig = serde_json::from_slice(&plaintext)?;
    Ok(normalize_config(parsed))
}

fn write_file_atomic(path: &Path, bytes: &[u8]) -> Result<(), ConfigError> {
    let parent_dir = path
        .parent()
        .ok_or(ConfigError::Crypto("Config path has no parent directory."))?;
    ensure_directory(parent_dir)?;

    let mut random_suffix = [0_u8; 8];
    OsRng.fill_bytes(&mut random_suffix);
    let temp_file_name = format!(
        ".{}.tmp-{:016x}",
        path.file_name().and_then(|name| name.to_str()).unwrap_or("config"),
        u64::from_le_bytes(random_suffix)
    );
    let temp_path = parent_dir.join(temp_file_name);

    let mut temp_file = open_new_private_file(&temp_path)?;
    temp_file.write_all(bytes)?;
    temp_file.sync_all()?;
    drop(temp_file);

    fs::rename(&temp_path, path).map_err(|error| {
        let _ = fs::remove_file(&temp_path);
        ConfigError::Io(error)
    })?;

    Ok(())
}

fn load_config_in_directory(base_dir: &Path) -> Result<AppConfig, ConfigError> {
    let key = load_or_create_key(base_dir)?;
    let encrypted_path = config_path(base_dir);
    if !encrypted_path.exists() {
        return Ok(AppConfig::default());
    }

    let payload = fs::read(encrypted_path)?;
    match decrypt_config(&payload, &key) {
        Ok(config) => Ok(config),
        Err(ConfigError::Crypto(_)) | Err(ConfigError::Serde(_)) => Ok(AppConfig::default()),
        Err(error) => Err(error),
    }
}

fn save_config_in_directory(base_dir: &Path, config: AppConfig) -> Result<(), ConfigError> {
    let key = load_or_create_key(base_dir)?;
    let normalized = normalize_config(config);
    let payload = encrypt_config(&normalized, &key)?;
    write_file_atomic(&config_path(base_dir), &payload)
}

#[tauri::command]
pub fn read_config() -> Result<AppConfig, String> {
    let directory = resolve_app_directory().map_err(|error| error.to_string())?;
    load_config_in_directory(&directory).map_err(|error| error.to_string())
}

#[tauri::command]
pub fn write_config(config: AppConfig) -> Result<(), String> {
    let directory = resolve_app_directory().map_err(|error| error.to_string())?;
    save_config_in_directory(&directory, config).map_err(|error| error.to_string())
}

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::tempdir;

    fn sample_config() -> AppConfig {
        AppConfig {
            openai_api_key: "sk-test-123".to_string(),
            model: "gpt-5-nano-2025-08-07".to_string(),
            temperature: 0.4,
            streaming: true,
            token_protection: true,
            smart_structuring: true,
        }
    }

    #[test]
    fn encryption_round_trip_succeeds() {
        let mut key = [0_u8; KEY_LENGTH_BYTES];
        OsRng.fill_bytes(&mut key);
        let config = sample_config();

        let encrypted = encrypt_config(&config, &key).expect("encrypt config");
        let decrypted = decrypt_config(&encrypted, &key).expect("decrypt config");

        assert_eq!(decrypted, config);
    }

    #[test]
    fn load_save_cycle_succeeds() {
        let temp_directory = tempdir().expect("create temporary directory");
        let base_dir = temp_directory.path();
        let config = sample_config();

        let empty_loaded = load_config_in_directory(base_dir).expect("load defaults");
        assert_eq!(empty_loaded, AppConfig::default());

        save_config_in_directory(base_dir, config.clone()).expect("save config");
        let loaded = load_config_in_directory(base_dir).expect("load saved config");
        assert_eq!(loaded, config);

        assert!(key_path(base_dir).exists());
        assert!(config_path(base_dir).exists());
    }

    #[test]
    fn corrupted_config_fails_safe_to_default() {
        let temp_directory = tempdir().expect("create temporary directory");
        let base_dir = temp_directory.path();

        let _ = load_config_in_directory(base_dir).expect("load defaults and create key");
        fs::write(config_path(base_dir), b"not-valid-encrypted-content").expect("write corrupt config");

        let loaded = load_config_in_directory(base_dir).expect("load corrupted config safely");
        assert_eq!(loaded, AppConfig::default());
    }

    #[test]
    fn legacy_config_without_smart_structuring_defaults_to_true() {
        let mut key = [0_u8; KEY_LENGTH_BYTES];
        OsRng.fill_bytes(&mut key);

        let plaintext = serde_json::json!({
            "openaiApiKey": "sk-test-123",
            "model": "gpt-5-nano-2025-08-07",
            "temperature": 0.4,
            "streaming": true,
            "tokenProtection": false
        });

        let cipher = Aes256Gcm::new_from_slice(&key).expect("create cipher");
        let mut nonce_bytes = [0_u8; NONCE_LENGTH_BYTES];
        OsRng.fill_bytes(&mut nonce_bytes);
        let ciphertext = cipher
            .encrypt(
                Nonce::from_slice(&nonce_bytes),
                serde_json::to_vec(&plaintext).expect("serialize legacy config").as_ref(),
            )
            .expect("encrypt legacy config");

        let mut payload = Vec::with_capacity(NONCE_LENGTH_BYTES + ciphertext.len());
        payload.extend_from_slice(&nonce_bytes);
        payload.extend_from_slice(&ciphertext);

        let config = decrypt_config(&payload, &key).expect("decrypt legacy config");
        assert_eq!(
            config,
            AppConfig {
                openai_api_key: "sk-test-123".to_string(),
                model: "gpt-5-nano-2025-08-07".to_string(),
                temperature: 0.4,
                streaming: true,
                token_protection: false,
                smart_structuring: true,
            }
        );
    }
}
