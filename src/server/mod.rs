pub mod protocol;
pub mod routes;

use crate::server::protocol::{RpcRequest, RpcResponse};
use crate::server::routes::{AppState, dispatch};
use std::fs;
use std::os::unix::fs::PermissionsExt;
use std::path::Path;
use tokio::io::{AsyncBufReadExt, AsyncWriteExt, BufReader};
use tokio::net::{UnixListener, UnixStream};
use tokio::sync::watch;
use tracing::{error, info, warn};

pub async fn run(
    state: AppState,
    mut shutdown_rx: watch::Receiver<bool>,
) -> Result<(), std::io::Error> {
    let socket_path = &state.config.socket_path;
    if Path::new(socket_path).exists() {
        fs::remove_file(socket_path)?;
    }

    let listener = UnixListener::bind(socket_path)?;
    fs::set_permissions(socket_path, fs::Permissions::from_mode(0o600))?;
    info!("listening on {}", socket_path.display());

    let cleanup_path = socket_path.clone();
    let cleanup_guard = ScopeGuard::new(move || {
        if Path::new(&cleanup_path).exists() {
            let _ = fs::remove_file(&cleanup_path);
        }
    });

    loop {
        tokio::select! {
            changed = shutdown_rx.changed() => {
                if changed.is_ok() {
                    info!("shutdown signal received in server");
                    break;
                }
            }
            accepted = listener.accept() => {
                match accepted {
                    Ok((stream, _addr)) => {
                        let app_state = state.clone();
                        tokio::spawn(async move {
                            if let Err(err) = handle_connection(stream, app_state).await {
                                warn!("connection error: {}", err);
                            }
                        });
                    }
                    Err(err) => {
                        error!("accept error: {}", err);
                    }
                }
            }
        }
    }

    drop(cleanup_guard);
    Ok(())
}

async fn handle_connection(stream: UnixStream, state: AppState) -> Result<(), std::io::Error> {
    let (reader, mut writer) = stream.into_split();
    let mut lines = BufReader::new(reader).lines();

    while let Some(line) = lines.next_line().await? {
        if line.trim().is_empty() {
            continue;
        }

        let response = match serde_json::from_str::<RpcRequest>(&line) {
            Ok(request) => {
                info!("request method={} id={}", request.method, request.id);
                dispatch(request, state.clone()).await
            }
            Err(err) => RpcResponse::error(
                "unknown".to_string(),
                "INVALID_PARAMS",
                format!("invalid JSON request: {err}"),
            ),
        };

        let body = serde_json::to_string(&response).unwrap_or_else(|_| {
            "{\"id\":\"unknown\",\"ok\":false,\"error\":{\"code\":\"INTERNAL_ERROR\",\"message\":\"serialization failed\"}}".to_string()
        });
        writer.write_all(body.as_bytes()).await?;
        writer.write_all(b"\n").await?;
    }

    Ok(())
}

struct ScopeGuard<F: FnOnce()> {
    callback: Option<F>,
}

impl<F: FnOnce()> ScopeGuard<F> {
    fn new(callback: F) -> Self {
        Self {
            callback: Some(callback),
        }
    }
}

impl<F: FnOnce()> Drop for ScopeGuard<F> {
    fn drop(&mut self) {
        if let Some(cb) = self.callback.take() {
            cb();
        }
    }
}
