use crate::types::*;
use anyhow::{bail, Context, Result};
use tokio::io::{AsyncBufReadExt, AsyncWriteExt, BufReader};
use tokio::net::UnixStream;

/// Default daemon socket path.
pub const DEFAULT_SOCKET_PATH: &str = "/tmp/trl.sock";

/// Async client for the claw_core daemon.
///
/// Communicates over a Unix socket using line-delimited JSON (one request per
/// line, one response per line).
///
/// # Example
///
/// ```no_run
/// use claw_core_protocol::{ClawCoreClient, CreateSessionParams, ExecRunParams};
///
/// # async fn example() -> anyhow::Result<()> {
/// let mut client = ClawCoreClient::connect("/tmp/trl.sock").await?;
///
/// let session = client.create_session(CreateSessionParams::default()).await?;
/// let result = client.exec_run(ExecRunParams {
///     session_id: session.session_id.clone(),
///     command: "echo hello".into(),
///     timeout_s: Some(30),
///     stdin: None,
///     env: None,
/// }).await?;
///
/// println!("stdout: {}", result.stdout);
/// # Ok(())
/// # }
/// ```
pub struct ClawCoreClient {
    reader: BufReader<tokio::io::ReadHalf<UnixStream>>,
    writer: tokio::io::WriteHalf<UnixStream>,
    req_counter: u64,
}

impl ClawCoreClient {
    /// Connect to the claw_core daemon at the given Unix socket path.
    pub async fn connect(socket_path: &str) -> Result<Self> {
        let stream = UnixStream::connect(socket_path)
            .await
            .with_context(|| format!("failed to connect to claw_core daemon at {socket_path}"))?;
        let (read_half, write_half) = tokio::io::split(stream);
        Ok(Self {
            reader: BufReader::new(read_half),
            writer: write_half,
            req_counter: 0,
        })
    }

    /// Send a raw RPC request and return the parsed response.
    pub async fn send_request(
        &mut self,
        method: &str,
        params: serde_json::Value,
    ) -> Result<RpcResponse> {
        self.req_counter += 1;
        let request = RpcRequest {
            id: format!("req-{}", self.req_counter),
            method: method.to_string(),
            params,
        };

        let mut line = serde_json::to_string(&request)
            .context("failed to serialize RPC request")?;
        line.push('\n');

        self.writer
            .write_all(line.as_bytes())
            .await
            .context("failed to write to claw_core socket")?;
        self.writer.flush().await.context("failed to flush socket")?;

        let mut response_line = String::new();
        let bytes_read = self
            .reader
            .read_line(&mut response_line)
            .await
            .context("failed to read response from claw_core socket")?;

        if bytes_read == 0 {
            bail!("claw_core daemon closed the connection");
        }

        let response: RpcResponse = serde_json::from_str(response_line.trim())
            .context("failed to parse RPC response from claw_core")?;

        Ok(response)
    }

    // -----------------------------------------------------------------------
    // Convenience methods
    // -----------------------------------------------------------------------

    /// `system.ping` — health check.
    pub async fn ping(&mut self) -> Result<PingResult> {
        let resp = self.send_request("system.ping", serde_json::json!({})).await?;
        extract_data(resp)
    }

    /// `system.stats` — runtime statistics.
    pub async fn stats(&mut self) -> Result<SystemStats> {
        let resp = self.send_request("system.stats", serde_json::json!({})).await?;
        extract_data(resp)
    }

    /// `session.create` — create a new terminal session.
    pub async fn create_session(
        &mut self,
        params: CreateSessionParams,
    ) -> Result<CreateSessionResult> {
        let value = serde_json::to_value(&params).context("serialize CreateSessionParams")?;
        let resp = self.send_request("session.create", value).await?;
        extract_data(resp)
    }

    /// `session.list` — list active sessions.
    pub async fn list_sessions(&mut self) -> Result<SessionListResult> {
        let resp = self.send_request("session.list", serde_json::json!({})).await?;
        extract_data(resp)
    }

    /// `session.info` — get details about a session.
    pub async fn session_info(&mut self, session_id: &str) -> Result<SessionInfo> {
        let resp = self
            .send_request("session.info", serde_json::json!({ "session_id": session_id }))
            .await?;
        extract_data(resp)
    }

    /// `session.destroy` — terminate and clean up a session.
    pub async fn destroy_session(
        &mut self,
        params: DestroySessionParams,
    ) -> Result<DestroySessionResult> {
        let value = serde_json::to_value(&params).context("serialize DestroySessionParams")?;
        let resp = self.send_request("session.destroy", value).await?;
        extract_data(resp)
    }

    /// `exec.run` — execute a command in a session (buffered, waits for completion).
    pub async fn exec_run(&mut self, params: ExecRunParams) -> Result<ExecRunResult> {
        let value = serde_json::to_value(&params).context("serialize ExecRunParams")?;
        let resp = self.send_request("exec.run", value).await?;
        extract_data(resp)
    }
}

/// Extract typed data from a successful [`RpcResponse`], or return an error.
fn extract_data<T: serde::de::DeserializeOwned>(resp: RpcResponse) -> Result<T> {
    if !resp.ok {
        let err = resp.error.unwrap_or(RpcError {
            code: "UNKNOWN".to_string(),
            message: "unknown error".to_string(),
        });
        bail!("claw_core error [{}]: {}", err.code, err.message);
    }
    let data = resp.data.context("response ok=true but data is null")?;
    serde_json::from_value(data).context("failed to deserialize response data")
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn default_socket_path_is_set() {
        assert_eq!(DEFAULT_SOCKET_PATH, "/tmp/trl.sock");
    }

    #[test]
    fn extract_data_success() {
        let resp = RpcResponse {
            id: "req-1".into(),
            ok: true,
            data: Some(serde_json::json!({ "uptime_s": 42, "version": "0.1.0" })),
            error: None,
        };
        let ping: PingResult = extract_data(resp).unwrap();
        assert_eq!(ping.uptime_s, 42);
        assert_eq!(ping.version, "0.1.0");
    }

    #[test]
    fn extract_data_error() {
        let resp = RpcResponse {
            id: "req-2".into(),
            ok: false,
            data: None,
            error: Some(RpcError {
                code: "SESSION_NOT_FOUND".into(),
                message: "session not found".into(),
            }),
        };
        let result = extract_data::<PingResult>(resp);
        assert!(result.is_err());
        let err_msg = result.unwrap_err().to_string();
        assert!(err_msg.contains("SESSION_NOT_FOUND"));
    }

    #[test]
    fn create_session_params_default_serializes_cleanly() {
        let params = CreateSessionParams::default();
        let json = serde_json::to_string(&params).unwrap();
        assert_eq!(json, "{}");
    }

    #[test]
    fn exec_run_params_serializes() {
        let params = ExecRunParams {
            session_id: "s-123".into(),
            command: "echo hi".into(),
            timeout_s: Some(30),
            stdin: None,
            env: None,
        };
        let json: serde_json::Value = serde_json::to_value(&params).unwrap();
        assert_eq!(json["session_id"], "s-123");
        assert_eq!(json["command"], "echo hi");
        assert_eq!(json["timeout_s"], 30);
        assert!(json.get("stdin").is_none());
    }
}
