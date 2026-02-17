use serde::{Deserialize, Serialize};
use std::collections::HashMap;

// ---------------------------------------------------------------------------
// RPC envelope
// ---------------------------------------------------------------------------

/// A JSON-RPC-style request sent to the claw_core daemon.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RpcRequest {
    pub id: String,
    pub method: String,
    #[serde(default = "default_params")]
    pub params: serde_json::Value,
}

/// A JSON-RPC-style response from the claw_core daemon.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RpcResponse {
    pub id: String,
    pub ok: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub data: Option<serde_json::Value>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error: Option<RpcError>,
}

/// Structured error inside an [`RpcResponse`].
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RpcError {
    pub code: String,
    pub message: String,
}

fn default_params() -> serde_json::Value {
    serde_json::Value::Object(serde_json::Map::new())
}

// ---------------------------------------------------------------------------
// session.create
// ---------------------------------------------------------------------------

/// Parameters for `session.create`.
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct CreateSessionParams {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub shell: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub env: Option<HashMap<String, String>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub working_dir: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub name: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub timeout_s: Option<u64>,
}

/// Data returned by a successful `session.create`.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CreateSessionResult {
    pub session_id: String,
    pub shell: String,
    pub working_dir: String,
    pub state: String,
    pub created_at: String,
}

// ---------------------------------------------------------------------------
// session.info
// ---------------------------------------------------------------------------

/// Data returned by a successful `session.info`.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SessionInfo {
    pub session_id: String,
    pub name: Option<String>,
    pub shell: String,
    pub working_dir: String,
    pub state: String,
    #[serde(default)]
    pub env_keys: Vec<String>,
    pub created_at: String,
    #[serde(default)]
    pub last_activity: Option<String>,
    #[serde(default)]
    pub command_count: u64,
    #[serde(default)]
    pub timeout_s: u64,
}

// ---------------------------------------------------------------------------
// session.list
// ---------------------------------------------------------------------------

/// Wrapper for the `session.list` response data.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SessionListResult {
    pub sessions: Vec<serde_json::Value>,
}

// ---------------------------------------------------------------------------
// session.destroy
// ---------------------------------------------------------------------------

/// Parameters for `session.destroy`.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DestroySessionParams {
    pub session_id: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub force: Option<bool>,
}

/// Data returned by a successful `session.destroy`.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DestroySessionResult {
    pub session_id: String,
    pub state: String,
}

// ---------------------------------------------------------------------------
// exec.run
// ---------------------------------------------------------------------------

/// Parameters for `exec.run`.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ExecRunParams {
    pub session_id: String,
    pub command: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub timeout_s: Option<u64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub stdin: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub env: Option<HashMap<String, String>>,
}

/// Data returned by a successful `exec.run`.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ExecRunResult {
    #[serde(default)]
    pub stdout: String,
    #[serde(default)]
    pub stderr: String,
    #[serde(default)]
    pub exit_code: i32,
    #[serde(default)]
    pub duration_ms: u64,
    #[serde(default)]
    pub timed_out: bool,
}

// ---------------------------------------------------------------------------
// system.ping / system.stats
// ---------------------------------------------------------------------------

/// Data returned by `system.ping`.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PingResult {
    pub uptime_s: u64,
    pub version: String,
}

/// Data returned by `system.stats`.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SystemStats {
    pub active_sessions: usize,
    pub total_commands_run: u64,
    pub uptime_s: u64,
    #[serde(default)]
    pub memory_rss_bytes: u64,
    #[serde(default)]
    pub open_fds: u64,
}

// ---------------------------------------------------------------------------
// Error codes
// ---------------------------------------------------------------------------

/// Well-known error codes returned by the daemon.
pub mod error_codes {
    pub const SESSION_NOT_FOUND: &str = "SESSION_NOT_FOUND";
    pub const SESSION_BUSY: &str = "SESSION_BUSY";
    pub const COMMAND_TIMEOUT: &str = "COMMAND_TIMEOUT";
    pub const INVALID_PARAMS: &str = "INVALID_PARAMS";
    pub const INTERNAL_ERROR: &str = "INTERNAL_ERROR";
    pub const RESOURCE_PRESSURE: &str = "RESOURCE_PRESSURE";
    pub const SESSION_LIMIT_EXCEEDED: &str = "SESSION_LIMIT_EXCEEDED";
    pub const MAX_SESSIONS_REACHED: &str = "MAX_SESSIONS_REACHED";
}
