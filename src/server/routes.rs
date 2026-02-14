use crate::config::Config;
use crate::executor::buffered::{self, ExecError, ExecInput};
use crate::resource::RuntimeStats;
use crate::server::protocol::{RpcRequest, RpcResponse};
use crate::session::pool::{CreateSessionInput, SessionPool, SessionPoolError};
use serde::Deserialize;
use serde_json::json;
use std::collections::HashMap;
use std::sync::Arc;
use tokio::sync::RwLock;
use tracing::warn;

#[derive(Clone)]
pub struct AppState {
    pub config: Arc<Config>,
    pub sessions: Arc<RwLock<SessionPool>>,
    pub stats: Arc<RuntimeStats>,
}

pub async fn dispatch(req: RpcRequest, state: AppState) -> RpcResponse {
    match req.method.as_str() {
        "system.ping" => RpcResponse::success(
            req.id,
            json!({
                "uptime_s": state.stats.uptime_s(),
                "version": env!("CARGO_PKG_VERSION"),
            }),
        ),
        "system.stats" => {
            let active_sessions = state.sessions.read().await.active_sessions();
            RpcResponse::success(
                req.id,
                json!({
                    "active_sessions": active_sessions,
                    "total_commands_run": state.stats.total_commands(),
                    "uptime_s": state.stats.uptime_s(),
                    "memory_rss_bytes": state.stats.memory_rss_bytes(),
                    "open_fds": state.stats.open_fds(),
                }),
            )
        }
        "session.create" => create_session(req, state).await,
        "session.list" => list_sessions(req, state).await,
        "session.info" => session_info(req, state).await,
        "session.destroy" => destroy_session(req, state).await,
        "exec.run" => exec_run(req, state).await,
        _ => RpcResponse::error(req.id, "INVALID_PARAMS", "unsupported method"),
    }
}

#[derive(Deserialize)]
struct CreateSessionParams {
    shell: Option<String>,
    env: Option<HashMap<String, String>>,
    working_dir: Option<String>,
    name: Option<String>,
    timeout_s: Option<u64>,
}

async fn create_session(req: RpcRequest, state: AppState) -> RpcResponse {
    let parsed = serde_json::from_value::<CreateSessionParams>(req.params);
    let params = match parsed {
        Ok(p) => p,
        Err(err) => return RpcResponse::error(req.id, "INVALID_PARAMS", err.to_string()),
    };

    // GC: FD pressure response - reject new sessions if FDs too high
    let open_fds = state.stats.open_fds();
    if open_fds > state.config.fd_warning_threshold {
        warn!(
            "rejecting session.create: FD pressure (open_fds={}, threshold={})",
            open_fds, state.config.fd_warning_threshold
        );
        return RpcResponse::error(
            req.id,
            "RESOURCE_PRESSURE",
            format!(
                "system under resource pressure (open FDs: {}); close idle sessions or reduce load",
                open_fds
            ),
        );
    }

    let env = params.env.unwrap_or_default();
    let input = CreateSessionInput {
        shell: params.shell.unwrap_or_else(|| "/bin/sh".to_string()),
        env,
        working_dir: params.working_dir.unwrap_or_else(|| "/tmp".to_string()),
        name: params.name,
        timeout_s: params.timeout_s.unwrap_or(state.config.default_timeout_s),
    };

    let result = state.sessions.write().await.create_session(input);
    match result {
        Ok(session) => RpcResponse::success(
            req.id,
            json!({
                "session_id": session.session_id,
                "shell": session.shell,
                "working_dir": session.working_dir,
                "state": session.state,
                "created_at": session.created_at,
            }),
        ),
        Err(err) => RpcResponse::error(req.id, err_code(&err), err_message(err)),
    }
}

async fn list_sessions(req: RpcRequest, state: AppState) -> RpcResponse {
    let sessions = state.sessions.read().await.list_sessions();
    RpcResponse::success(req.id, json!({ "sessions": sessions }))
}

#[derive(Deserialize)]
struct SessionIdParams {
    session_id: String,
}

async fn session_info(req: RpcRequest, state: AppState) -> RpcResponse {
    let parsed = serde_json::from_value::<SessionIdParams>(req.params);
    let params = match parsed {
        Ok(p) => p,
        Err(err) => return RpcResponse::error(req.id, "INVALID_PARAMS", err.to_string()),
    };

    match state.sessions.read().await.get_session(&params.session_id) {
        Some(session) => {
            let env_keys: Vec<String> = session.env.keys().cloned().collect();
            RpcResponse::success(
                req.id,
                json!({
                    "session_id": session.session_id,
                    "name": session.name,
                    "shell": session.shell,
                    "working_dir": session.working_dir,
                    "state": session.state,
                    "env_keys": env_keys,
                    "created_at": session.created_at,
                    "last_activity": session.last_activity,
                    "command_count": session.command_count,
                    "timeout_s": session.timeout_s,
                }),
            )
        }
        None => RpcResponse::error(req.id, "SESSION_NOT_FOUND", "session not found"),
    }
}

#[derive(Deserialize)]
struct DestroyParams {
    session_id: String,
    force: Option<bool>,
}

async fn destroy_session(req: RpcRequest, state: AppState) -> RpcResponse {
    let parsed = serde_json::from_value::<DestroyParams>(req.params);
    let params = match parsed {
        Ok(p) => p,
        Err(err) => return RpcResponse::error(req.id, "INVALID_PARAMS", err.to_string()),
    };

    let force = params.force.unwrap_or(false);
    let result = state
        .sessions
        .write()
        .await
        .destroy_session(&params.session_id, force);
    match result {
        Ok(_) => RpcResponse::success(
            req.id,
            json!({
                "session_id": params.session_id,
                "state": "terminated",
            }),
        ),
        Err(err) => RpcResponse::error(req.id, err_code(&err), err_message(err)),
    }
}

#[derive(Deserialize)]
struct ExecRunParams {
    session_id: String,
    command: String,
    timeout_s: Option<u64>,
    stdin: Option<String>,
    env: Option<HashMap<String, String>>,
}

async fn exec_run(req: RpcRequest, state: AppState) -> RpcResponse {
    let parsed = serde_json::from_value::<ExecRunParams>(req.params);
    let params = match parsed {
        Ok(p) => p,
        Err(err) => return RpcResponse::error(req.id, "INVALID_PARAMS", err.to_string()),
    };

    // GC: Check if session exceeded max commands before running
    {
        let sessions = state.sessions.read().await;
        if let Some(session) = sessions.get_session(&params.session_id)
            && session.has_exceeded_max_commands(state.config.session_max_commands)
        {
            return RpcResponse::error(
                req.id,
                "SESSION_LIMIT_EXCEEDED",
                format!(
                    "session has exceeded max commands ({}); create a new session",
                    state.config.session_max_commands
                ),
            );
        }
    }

    let command = params.command;
    let timeout_override = params.timeout_s;
    let stdin = params.stdin;
    let command_env = params.env.unwrap_or_default();

    let (shell, working_dir, merged_env, timeout_s) = {
        let mut sessions = state.sessions.write().await;
        if let Err(err) = sessions.mark_running(&params.session_id) {
            return RpcResponse::error(req.id, err_code(&err), err_message(err));
        }

        let session = match sessions.get_session(&params.session_id) {
            Some(s) => s,
            None => {
                return RpcResponse::error(req.id, "SESSION_NOT_FOUND", "session not found");
            }
        };

        let mut merged_env = state.config.runtime_env.clone();
        merged_env.extend(session.env.clone());
        merged_env.extend(command_env);
        let timeout_s = resolve_timeout_s(timeout_override, session.timeout_s, &command);
        (session.shell, session.working_dir, merged_env, timeout_s)
    };

    let result = buffered::run(
        ExecInput {
            shell,
            command,
            working_dir,
            env: merged_env,
            stdin,
            timeout_s,
        },
        &state.config,
    )
    .await;

    if let Err(err) = state.sessions.write().await.mark_idle(&params.session_id) {
        warn!("failed to mark session idle: {}", err_message(err));
    }

    match result {
        Ok(exec_result) => {
            state.stats.inc_commands();
            RpcResponse::success(req.id, json!(exec_result))
        }
        Err(ExecError::Timeout) => {
            RpcResponse::error(req.id, "COMMAND_TIMEOUT", "command timed out")
        }
        Err(ExecError::Io(err)) => RpcResponse::error(req.id, "INTERNAL_ERROR", err.to_string()),
    }
}

fn resolve_timeout_s(
    override_timeout_s: Option<u64>,
    session_timeout_s: u64,
    command: &str,
) -> u64 {
    if let Some(timeout_s) = override_timeout_s {
        return timeout_s;
    }

    if looks_like_cursor_agent(command) {
        return session_timeout_s.max(600);
    }

    session_timeout_s
}

fn looks_like_cursor_agent(command: &str) -> bool {
    let normalized = command.trim_start();
    normalized.starts_with("cursor agent ")
        || normalized == "cursor agent"
        || normalized.starts_with("cursor-agent ")
}

fn err_code(err: &SessionPoolError) -> &'static str {
    match err {
        SessionPoolError::MaxSessionsReached => "MAX_SESSIONS_REACHED",
        SessionPoolError::SessionNotFound => "SESSION_NOT_FOUND",
        SessionPoolError::SessionBusy => "SESSION_BUSY",
        SessionPoolError::InvalidShell(_) => "INVALID_PARAMS",
        SessionPoolError::InvalidWorkingDir(_) => "INVALID_PARAMS",
    }
}

fn err_message(err: SessionPoolError) -> String {
    match err {
        SessionPoolError::MaxSessionsReached => "max sessions reached".to_string(),
        SessionPoolError::SessionNotFound => "session not found".to_string(),
        SessionPoolError::SessionBusy => "session is already running".to_string(),
        SessionPoolError::InvalidShell(shell) => format!("shell not found: {shell}"),
        SessionPoolError::InvalidWorkingDir(cwd) => format!("working_dir not found: {cwd}"),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn defaults_cursor_agent_to_longer_timeout() {
        assert_eq!(
            resolve_timeout_s(None, 60, "cursor agent \"fix this\" --print"),
            600
        );
    }

    #[test]
    fn respects_explicit_timeout_override() {
        assert_eq!(resolve_timeout_s(Some(42), 60, "cursor agent \"x\""), 42);
    }

    #[test]
    fn keeps_session_timeout_for_non_cursor_command() {
        assert_eq!(resolve_timeout_s(None, 75, "echo hello"), 75);
    }
}
