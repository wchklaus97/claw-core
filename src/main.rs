use clap::Parser;
use claw_core::config::{Cli, Config};
use claw_core::resource::RuntimeStats;
use claw_core::security::ensure_non_root;
use claw_core::server;
use claw_core::server::routes::AppState;
use claw_core::session::pool::SessionPool;
use std::fs;
use std::path::{Path, PathBuf};
use std::sync::Arc;
use tokio::signal;
use tokio::sync::{RwLock, watch};
use tracing::{error, info, warn};
use tracing_subscriber::EnvFilter;

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    tracing_subscriber::fmt()
        .with_env_filter(
            EnvFilter::try_from_default_env().unwrap_or_else(|_| EnvFilter::new("info")),
        )
        .init();

    let cli = Cli::parse();
    let config = Config::from_cli(cli)?;
    if let Err(err) = ensure_non_root(config.allow_root) {
        return Err(err.into());
    }

    // PID guard: prevent duplicate instances
    let pid_path = derive_pid_path(&config.socket_path);
    if let Err(err) = check_and_write_pid(&pid_path) {
        error!("cannot start: {}", err);
        return Err(err.into());
    }
    let _pid_guard = PidGuard::new(pid_path.clone());

    let max_sessions = config.max_sessions;
    let state = AppState {
        config: Arc::new(config),
        sessions: Arc::new(RwLock::new(SessionPool::new(max_sessions))),
        stats: Arc::new(RuntimeStats::new()),
    };

    let (shutdown_tx, shutdown_rx) = watch::channel(false);
    let bg_state = state.clone();
    let background_shutdown_rx = shutdown_rx.clone();
    let cleanup_task = tokio::spawn(async move {
        periodic_cleanup(bg_state, background_shutdown_rx).await;
    });

    let server_task = tokio::spawn(server::run(state.clone(), shutdown_rx));
    wait_for_shutdown_signal().await;
    info!("shutdown requested");
    let _ = shutdown_tx.send(true);

    if let Err(err) = cleanup_task.await {
        warn!("cleanup task join error: {}", err);
    }

    match server_task.await {
        Ok(result) => result?,
        Err(err) => return Err(format!("server task join error: {err}").into()),
    }

    let cleared = state.sessions.write().await.destroy_all();
    if cleared > 0 {
        info!("destroyed {} sessions during shutdown", cleared);
    }

    info!("runtime stopped");
    Ok(())
}

async fn wait_for_shutdown_signal() {
    #[cfg(unix)]
    {
        use tokio::signal::unix::{SignalKind, signal};
        let mut sigterm = signal(SignalKind::terminate()).expect("sigterm handler");
        tokio::select! {
            _ = signal::ctrl_c() => {}
            _ = sigterm.recv() => {}
        }
    }

    #[cfg(not(unix))]
    {
        let _ = signal::ctrl_c().await;
    }
}

async fn periodic_cleanup(state: AppState, mut shutdown_rx: watch::Receiver<bool>) {
    let mut interval = tokio::time::interval(std::time::Duration::from_secs(60));
    loop {
        tokio::select! {
            changed = shutdown_rx.changed() => {
                if changed.is_ok() {
                    break;
                }
            }
            _ = interval.tick() => {
                // 1. Cleanup idle sessions
                let removed_idle = state
                    .sessions
                    .write()
                    .await
                    .cleanup_idle_sessions(state.config.max_idle_sec);
                if removed_idle > 0 {
                    info!("GC: cleaned up {} idle sessions", removed_idle);
                }

                // 2. Cleanup expired sessions (TTL)
                let removed_ttl = state
                    .sessions
                    .write()
                    .await
                    .cleanup_expired_sessions(state.config.session_ttl_sec);
                if removed_ttl > 0 {
                    info!("GC: cleaned up {} expired sessions (TTL)", removed_ttl);
                }

                // 3. Memory pressure cleanup
                let memory_mb = state.stats.memory_rss_bytes() / 1024 / 1024;
                if memory_mb > state.config.memory_pressure_mb {
                    warn!("GC: memory pressure: {}MB (threshold {}MB), cleaning up oldest idle sessions",
                          memory_mb, state.config.memory_pressure_mb);
                    let removed_mem = state.sessions.write().await.cleanup_oldest_idle(5);
                    if removed_mem > 0 {
                        info!("GC: cleaned up {} sessions due to memory pressure", removed_mem);
                    }
                }

                // 4. Session count warning
                let active = state.sessions.read().await.active_sessions();
                let max = state.config.max_sessions;
                if active > (max * 80 / 100) {
                    warn!("GC: session count high: {}/{} ({}%)", active, max, active * 100 / max);
                }

                // 5. FD warning
                let open_fds = state.stats.open_fds();
                if open_fds > state.config.fd_warning_threshold {
                    warn!("GC: FD pressure: {} (threshold {})", open_fds, state.config.fd_warning_threshold);
                }

                // 6. Reap zombie children
                reap_zombies();
            }
        }
    }
}

fn reap_zombies() {
    #[cfg(unix)]
    {
        use nix::sys::wait::{WaitPidFlag, WaitStatus, waitpid};
        use nix::unistd::Pid;

        loop {
            match waitpid(Pid::from_raw(-1), Some(WaitPidFlag::WNOHANG)) {
                Ok(WaitStatus::Exited(pid, _)) => {
                    info!("reaped zombie process: {}", pid);
                }
                Ok(WaitStatus::Signaled(pid, _, _)) => {
                    info!("reaped signaled process: {}", pid);
                }
                Ok(WaitStatus::StillAlive) => break,
                Err(_) => break,
                _ => break,
            }
        }
    }
}

fn derive_pid_path(socket_path: &Path) -> PathBuf {
    let socket_name = socket_path
        .file_name()
        .unwrap_or_else(|| std::ffi::OsStr::new("trl.sock"));
    let pid_name = format!("{}.pid", socket_name.to_string_lossy().replace(".sock", ""));
    socket_path
        .parent()
        .unwrap_or_else(|| Path::new("/tmp"))
        .join(pid_name)
}

fn check_and_write_pid(pid_path: &Path) -> Result<(), String> {
    if pid_path.exists() {
        let contents =
            fs::read_to_string(pid_path).map_err(|e| format!("cannot read PID file: {}", e))?;
        if let Ok(pid) = contents.trim().parse::<i32>() {
            #[cfg(unix)]
            {
                use nix::sys::signal::{Signal, kill};
                use nix::unistd::Pid;
                if kill(Pid::from_raw(pid), Signal::SIGTERM).is_ok()
                    || kill(Pid::from_raw(pid), None).is_ok()
                {
                    return Err(format!(
                        "another instance is running (PID {}); stop it first or remove {}",
                        pid,
                        pid_path.display()
                    ));
                }
            }
            warn!("stale PID file (process {} not found); removing", pid);
            let _ = fs::remove_file(pid_path);
        }
    }

    let current_pid = std::process::id();
    fs::write(pid_path, format!("{}\n", current_pid))
        .map_err(|e| format!("cannot write PID file: {}", e))?;
    info!("wrote PID {} to {}", current_pid, pid_path.display());
    Ok(())
}

struct PidGuard {
    path: PathBuf,
}

impl PidGuard {
    fn new(path: PathBuf) -> Self {
        Self { path }
    }
}

impl Drop for PidGuard {
    fn drop(&mut self) {
        if self.path.exists() {
            let _ = fs::remove_file(&self.path);
        }
    }
}
