use chrono::{DateTime, Utc};
use serde::Serialize;
use std::collections::HashMap;

#[derive(Debug, Clone, Serialize, PartialEq, Eq)]
#[serde(rename_all = "lowercase")]
pub enum SessionState {
    Creating,
    Idle,
    Running,
    Terminated,
}

#[derive(Debug, Clone, Serialize)]
pub struct Session {
    pub session_id: String,
    pub name: Option<String>,
    pub shell: String,
    pub working_dir: String,
    pub env: HashMap<String, String>,
    pub state: SessionState,
    pub created_at: DateTime<Utc>,
    pub last_activity: DateTime<Utc>,
    pub command_count: u64,
    pub timeout_s: u64,
}

impl Session {
    pub fn is_idle_too_long(&self, max_idle_sec: u64, now: DateTime<Utc>) -> bool {
        if self.state != SessionState::Idle {
            return false;
        }
        let idle_secs = now.signed_duration_since(self.last_activity).num_seconds();
        idle_secs >= max_idle_sec as i64
    }

    pub fn has_exceeded_ttl(&self, ttl_sec: u64, now: DateTime<Utc>) -> bool {
        let age_secs = now.signed_duration_since(self.created_at).num_seconds();
        age_secs >= ttl_sec as i64
    }

    pub fn has_exceeded_max_commands(&self, max_commands: u64) -> bool {
        self.command_count >= max_commands
    }
}
