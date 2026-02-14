use clap::Parser;
use std::collections::HashMap;
use std::env;
use std::path::PathBuf;

#[derive(Debug, Clone, Parser)]
#[command(name = "claw_core")]
#[command(about = "Terminal Runtime Layer daemon")]
pub struct Cli {
    #[arg(long, env = "TRL_SOCKET_PATH", default_value = "/tmp/trl.sock")]
    pub socket_path: PathBuf,

    #[arg(long, env = "TRL_MAX_SESSIONS", default_value_t = 64)]
    pub max_sessions: usize,

    #[arg(long, env = "TRL_DEFAULT_TIMEOUT_S", default_value_t = 60)]
    pub default_timeout_s: u64,

    #[arg(long, env = "TRL_MAX_OUTPUT_BYTES", default_value_t = 4 * 1024 * 1024)]
    pub max_output_bytes: usize,

    #[arg(long, env = "TRL_MAX_IDLE_SEC", default_value_t = 3600)]
    pub max_idle_sec: u64,

    #[arg(long, env = "TRL_SESSION_TTL_SEC", default_value_t = 86400)]
    pub session_ttl_sec: u64,

    #[arg(long, env = "TRL_SESSION_MAX_COMMANDS", default_value_t = 1000)]
    pub session_max_commands: u64,

    #[arg(long, env = "TRL_FD_WARNING_THRESHOLD", default_value_t = 5000)]
    pub fd_warning_threshold: u64,

    #[arg(long, env = "TRL_MEMORY_PRESSURE_MB", default_value_t = 500)]
    pub memory_pressure_mb: u64,

    #[arg(long, env = "TRL_CHILD_CPU_SEC", default_value_t = 300)]
    pub child_cpu_sec: u64,

    #[arg(long, env = "TRL_CHILD_MEMORY_BYTES", default_value_t = 512 * 1024 * 1024)]
    pub child_memory_bytes: u64,

    #[arg(long, env = "TRL_CHILD_NPROC", default_value_t = 64)]
    pub child_nproc: u64,

    #[arg(long, env = "TRL_ALLOW_ROOT", default_value_t = false)]
    pub allow_root: bool,

    #[arg(long, env = "TRL_ENV_FILE")]
    pub env_file: Option<PathBuf>,
}

#[derive(Debug, Clone)]
pub struct Config {
    pub socket_path: PathBuf,
    pub max_sessions: usize,
    pub default_timeout_s: u64,
    pub max_output_bytes: usize,
    pub max_idle_sec: u64,
    pub session_ttl_sec: u64,
    pub session_max_commands: u64,
    pub fd_warning_threshold: u64,
    pub memory_pressure_mb: u64,
    pub child_cpu_sec: u64,
    pub child_memory_bytes: u64,
    pub child_nproc: u64,
    pub allow_root: bool,
    pub runtime_env: HashMap<String, String>,
}

impl Config {
    pub fn from_cli(cli: Cli) -> Result<Self, std::io::Error> {
        if let Some(path) = &cli.env_file {
            let _ = dotenvy::from_path(path);
        } else {
            let _ = dotenvy::dotenv();
        }

        let runtime_env = env::vars().collect::<HashMap<_, _>>();

        Ok(Self {
            socket_path: cli.socket_path,
            max_sessions: cli.max_sessions,
            default_timeout_s: cli.default_timeout_s,
            max_output_bytes: cli.max_output_bytes,
            max_idle_sec: cli.max_idle_sec,
            session_ttl_sec: cli.session_ttl_sec,
            session_max_commands: cli.session_max_commands,
            fd_warning_threshold: cli.fd_warning_threshold,
            memory_pressure_mb: cli.memory_pressure_mb,
            child_cpu_sec: cli.child_cpu_sec,
            child_memory_bytes: cli.child_memory_bytes,
            child_nproc: cli.child_nproc,
            allow_root: cli.allow_root,
            runtime_env,
        })
    }
}
