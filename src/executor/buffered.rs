use crate::config::Config;
use serde::Serialize;
use std::collections::HashMap;
use std::process::Stdio;
use std::time::Instant;
use tokio::io::AsyncWriteExt;
use tokio::process::Command;
use tokio::time::{Duration, timeout};

#[derive(Debug, Clone)]
pub struct ExecInput {
    pub shell: String,
    pub command: String,
    pub working_dir: String,
    pub env: HashMap<String, String>,
    pub stdin: Option<String>,
    pub timeout_s: u64,
}

#[derive(Debug, Serialize)]
pub struct ExecResult {
    pub stdout: String,
    pub stderr: String,
    pub exit_code: i32,
    pub duration_ms: u128,
    pub timed_out: bool,
}

#[derive(Debug)]
pub enum ExecError {
    Io(std::io::Error),
    Timeout,
}

impl From<std::io::Error> for ExecError {
    fn from(value: std::io::Error) -> Self {
        Self::Io(value)
    }
}

pub async fn run(input: ExecInput, config: &Config) -> Result<ExecResult, ExecError> {
    let started = Instant::now();

    let mut command = Command::new(&input.shell);
    command
        .arg("-c")
        .arg(input.command)
        .current_dir(&input.working_dir)
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .stdin(Stdio::piped())
        .kill_on_drop(true);

    for (k, v) in input.env {
        command.env(k, v);
    }

    unsafe {
        command.pre_exec({
            let cpu = config.child_cpu_sec;
            let as_bytes = config.child_memory_bytes;
            let nproc = config.child_nproc;
            move || {
                // Create new process group so we can kill all descendants on timeout
                #[cfg(unix)]
                {
                    use nix::unistd::setsid;
                    let _ = setsid();
                }

                let _ = rlimit::setrlimit(rlimit::Resource::CPU, cpu, cpu);
                let _ = rlimit::setrlimit(rlimit::Resource::AS, as_bytes, as_bytes);
                let _ = rlimit::setrlimit(rlimit::Resource::NPROC, nproc, nproc);
                Ok(())
            }
        });
    }

    let mut child = command.spawn()?;
    let pid = child.id();

    if let Some(stdin_data) = input.stdin {
        if let Some(mut child_stdin) = child.stdin.take() {
            child_stdin.write_all(stdin_data.as_bytes()).await?;
            child_stdin.shutdown().await?;
        }
    }

    let join = tokio::spawn(async move { child.wait_with_output().await });
    let output = if input.timeout_s == 0 {
        join.await.map_err(std::io::Error::other)??
    } else {
        match timeout(Duration::from_secs(input.timeout_s), join).await {
            Ok(result) => result.map_err(std::io::Error::other)??,
            Err(_) => {
                if let Some(raw_pid) = pid {
                    #[cfg(unix)]
                    {
                        use nix::sys::signal::{Signal, kill};
                        use nix::unistd::Pid;
                        // Kill the whole process group (negative PID)
                        let _ = kill(Pid::from_raw(-(raw_pid as i32)), Signal::SIGKILL);
                    }
                }
                return Err(ExecError::Timeout);
            }
        }
    };

    let stdout = cap_output(output.stdout, config.max_output_bytes);
    let stderr = cap_output(output.stderr, config.max_output_bytes);

    Ok(ExecResult {
        stdout,
        stderr,
        exit_code: output.status.code().unwrap_or(-1),
        duration_ms: started.elapsed().as_millis(),
        timed_out: false,
    })
}

fn cap_output(bytes: Vec<u8>, max: usize) -> String {
    let mut text = String::from_utf8_lossy(&bytes).to_string();
    if text.len() > max {
        text.truncate(max);
    }
    text
}
