//! # claw-core-protocol
//!
//! Async Rust client and protocol types for the **claw_core** daemon.
//!
//! The daemon communicates via **line-delimited JSON over a Unix socket**
//! (default: `/tmp/trl.sock`). This crate provides:
//!
//! - **Protocol types** — [`RpcRequest`], [`RpcResponse`], method-specific
//!   param/result structs (e.g. [`ExecRunParams`], [`ExecRunResult`]).
//! - **Async client** — [`ClawCoreClient`] connects to the daemon and exposes
//!   typed convenience methods (`create_session`, `exec_run`, `ping`, etc.).
//!
//! ## Quick start
//!
//! ```no_run
//! use claw_core_protocol::{ClawCoreClient, CreateSessionParams, ExecRunParams};
//!
//! # async fn example() -> anyhow::Result<()> {
//! let mut client = ClawCoreClient::connect("/tmp/trl.sock").await?;
//!
//! // Create a session
//! let session = client.create_session(CreateSessionParams {
//!     shell: Some("/bin/zsh".into()),
//!     working_dir: Some("/tmp".into()),
//!     ..Default::default()
//! }).await?;
//!
//! // Run a command
//! let result = client.exec_run(ExecRunParams {
//!     session_id: session.session_id.clone(),
//!     command: "echo hello from claw_core".into(),
//!     timeout_s: Some(30),
//!     stdin: None,
//!     env: None,
//! }).await?;
//!
//! assert!(result.exit_code == 0);
//! println!("{}", result.stdout);
//!
//! // Clean up
//! client.destroy_session(claw_core_protocol::DestroySessionParams {
//!     session_id: session.session_id,
//!     force: None,
//! }).await?;
//! # Ok(())
//! # }
//! ```
//!
//! ## With ZeroClaw
//!
//! ZeroClaw can use this crate via the `claw-core` feature flag:
//!
//! ```bash
//! cargo install zeroclaw --features claw-core
//! ```

pub mod client;
pub mod types;

// Re-export the primary API at crate root for convenience.
pub use client::{ClawCoreClient, DEFAULT_SOCKET_PATH};
pub use types::*;
