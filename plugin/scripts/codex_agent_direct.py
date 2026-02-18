#!/usr/bin/env python3
"""
Direct OpenAI Codex CLI wrapper for OpenClaw plugin.

Invokes `codex exec` with structured JSON output and timeout handling.
Designed to be called by the claw-core plugin as an agent tool backend.

Usage:
  codex_agent_direct.py --prompt "..." [--workspace /path] [--model gpt-4.1-mini] [--mode agent|plan|ask] [--timeout 600]
  codex_agent_direct.py --help
  codex_agent_direct.py --check   # Check if Codex CLI is available

Modes:
  agent (default) = execute with auto approval
  plan            = plan before executing (--plan flag)
  ask             = read-only, approval policy set to never-auto

Output (JSON):
  { "ok": true, "output": "...", "exit_code": 0, "duration_ms": 1234,
    "files_created": [], "truncated": false }
"""
from __future__ import annotations

import argparse
import glob
import json
import os
import shutil
import subprocess
import sys
import time


MAX_OUTPUT_BYTES = 100 * 1024  # 100 KB


def find_codex_binary() -> str | None:
    """Locate the Codex CLI binary."""
    custom = os.environ.get("CODEX_PATH")
    if custom and shutil.which(custom):
        return custom
    if shutil.which("codex"):
        return "codex"
    # Common install locations (npm global install)
    for candidate in [
        os.path.expanduser("~/.local/bin/codex"),
        os.path.expanduser("~/.npm/bin/codex"),
        "/usr/local/bin/codex",
        "/usr/bin/codex",
        # macOS Homebrew
        "/opt/homebrew/bin/codex",
    ]:
        if os.path.isfile(candidate) and os.access(candidate, os.X_OK):
            return candidate
    return None


def check_codex() -> dict:
    """Check if Codex CLI is installed and return version info."""
    binary = find_codex_binary()
    if not binary:
        return {
            "installed": False,
            "error": "codex CLI not found on PATH. Install with: npm i -g @openai/codex",
        }
    try:
        result = subprocess.run(
            [binary, "--version"],
            capture_output=True,
            text=True,
            timeout=10,
        )
        version = result.stdout.strip() or result.stderr.strip()
        return {"installed": True, "binary": binary, "version": version}
    except Exception as exc:
        return {"installed": True, "binary": binary, "version": "unknown", "warning": str(exc)}


def detect_new_files(workspace: str, before_files: set[str]) -> list[str]:
    """Detect files created during the Codex run."""
    new_files: list[str] = []
    exts = ("*.py", "*.rs", "*.ts", "*.tsx", "*.js", "*.jsx", "*.md", "*.txt", "*.json", "*.html", "*.css", "*.toml")
    for ext in exts:
        for path in glob.glob(os.path.join(workspace, "**", ext), recursive=True):
            if path not in before_files and os.path.isfile(path):
                new_files.append(path)
    return sorted(set(new_files))


def snapshot_files(workspace: str) -> set[str]:
    """Snapshot code/artifact files in the workspace before the run."""
    files: set[str] = set()
    exts = ("*.py", "*.rs", "*.ts", "*.tsx", "*.js", "*.jsx", "*.md", "*.txt", "*.json", "*.html", "*.css", "*.toml")
    for ext in exts:
        for path in glob.glob(os.path.join(workspace, "**", ext), recursive=True):
            if os.path.isfile(path):
                files.add(path)
    return files


def _parse_codex_jsonl(raw: str) -> str:
    """
    Parse codex exec --json JSONL output and extract human-readable text.

    Codex outputs one JSON object per line:
      {"type":"thread.started",...}
      {"type":"item.completed","item":{"type":"agent_message","text":"..."}}
      {"type":"turn.failed","error":{"message":"..."}}

    Returns the concatenated agent messages and any errors as plain text.
    """
    messages: list[str] = []
    errors: list[str] = []
    for line in raw.splitlines():
        line = line.strip()
        if not line or not line.startswith("{"):
            continue
        try:
            obj = json.loads(line)
        except json.JSONDecodeError:
            continue
        obj_type = obj.get("type", "")
        if obj_type == "item.completed":
            item = obj.get("item", {})
            item_type = item.get("type", "")
            if item_type == "agent_message":
                text = item.get("text", "").strip()
                if text:
                    messages.append(text)
            elif item_type == "error":
                msg = item.get("message", "").strip()
                if msg:
                    errors.append(f"[error] {msg}")
        elif obj_type == "turn.failed":
            err = obj.get("error", {})
            msg = err.get("message", "") if isinstance(err, dict) else str(err)
            msg = msg.strip()
            if msg:
                errors.append(f"[failed] {msg}")
        elif obj_type == "error":
            msg = obj.get("message", "").strip()
            if msg:
                errors.append(f"[error] {msg}")

    parts = messages + errors
    return "\n\n".join(parts) if parts else ""


def run_codex_agent(
    prompt: str,
    workspace: str | None = None,
    model: str = "gpt-4.1-mini",
    mode: str = "agent",
    timeout_s: int = 600,
) -> dict:
    """
    Run codex exec non-interactively and return a structured result.

    mode:
      agent — execute with auto approval (default)
      plan  — plan then execute (--plan flag)
      ask   — read-only, approval set to never-auto (informational only)
    """
    binary = find_codex_binary()
    if not binary:
        return {
            "ok": False,
            "error": "codex CLI not found. Install with: npm i -g @openai/codex",
            "exit_code": -1,
            "output": "",
            "duration_ms": 0,
            "files_created": [],
            "truncated": False,
        }

    # Build base command: codex exec "<prompt>" --json
    cmd = [binary, "exec", prompt, "--json"]

    # Model — only pass --model if explicitly set (not "auto" or default)
    # When omitted, codex uses the model from ~/.codex/config.toml
    if model and model not in ("auto", "gpt-4.1-mini"):
        cmd.extend(["--model", model])

    # Mode / sandbox mapping
    # agent → workspace-write sandbox (default, --full-auto for convenience)
    # plan  → workspace-write sandbox (same execution, Codex plans internally)
    # ask   → read-only sandbox (no file writes or commands)
    if mode == "ask":
        cmd.extend(["--sandbox", "read-only"])
    else:
        # agent and plan: workspace-write is the safe default
        cmd.extend(["--sandbox", "workspace-write"])

    # Workspace
    if workspace:
        cmd.extend(["-C", workspace])

    effective_workspace = workspace or os.getcwd()

    before_files = snapshot_files(effective_workspace) if os.path.isdir(effective_workspace) else set()

    start_time = time.monotonic()
    try:
        result = subprocess.run(
            cmd,
            capture_output=True,
            text=True,
            timeout=timeout_s,
            cwd=workspace,
        )
        duration_ms = int((time.monotonic() - start_time) * 1000)

        raw_output = result.stdout or ""
        stderr = result.stderr or ""

        # Parse JSONL output from `codex exec --json` and extract agent messages.
        # Codex outputs one JSON object per line; we extract agent_message text
        # and error messages so the bot receives clean readable text, not raw JSON.
        output = _parse_codex_jsonl(raw_output)

        # If parsing yielded nothing useful, fall back to raw stdout
        if not output and raw_output.strip():
            output = raw_output

        # Append relevant stderr (ignore MCP auth noise)
        if stderr:
            relevant_stderr = "\n".join(
                line for line in stderr.splitlines()
                if line.strip() and "rmcp" not in line and "AUTH" not in line.upper()
                and "www_authenticate" not in line
            )
            if relevant_stderr.strip():
                output = (output + "\n--- stderr ---\n" + relevant_stderr).strip()

        truncated = False
        if len(output) > MAX_OUTPUT_BYTES:
            output = output[:MAX_OUTPUT_BYTES] + f"\n\n... [truncated at {MAX_OUTPUT_BYTES // 1024}KB]"
            truncated = True

        new_files = detect_new_files(effective_workspace, before_files) if os.path.isdir(effective_workspace) else []

        return {
            "ok": result.returncode == 0,
            "output": output,
            "exit_code": result.returncode,
            "duration_ms": duration_ms,
            "files_created": new_files,
            "truncated": truncated,
        }

    except subprocess.TimeoutExpired:
        duration_ms = int((time.monotonic() - start_time) * 1000)
        return {
            "ok": False,
            "error": f"codex exec timed out after {timeout_s}s",
            "output": "",
            "exit_code": -1,
            "duration_ms": duration_ms,
            "files_created": [],
            "truncated": False,
        }
    except Exception as exc:
        duration_ms = int((time.monotonic() - start_time) * 1000)
        return {
            "ok": False,
            "error": str(exc),
            "output": "",
            "exit_code": -1,
            "duration_ms": duration_ms,
            "files_created": [],
            "truncated": False,
        }


def main() -> int:
    ap = argparse.ArgumentParser(
        description="Direct OpenAI Codex CLI wrapper. Invokes codex exec with structured JSON output.",
    )
    ap.add_argument("--prompt", help="Prompt to send to Codex")
    ap.add_argument("--workspace", default=None, help="Workspace path (passed as --cd to codex)")
    ap.add_argument("--model", default="auto", help="Model to use (default: auto = use ~/.codex/config.toml)")
    ap.add_argument("--mode", default="agent", choices=["agent", "plan", "ask"],
                    help="Mode: agent (execute), plan (plan then execute), ask (read-only/suggest)")
    ap.add_argument("--timeout", type=int, default=600, help="Timeout in seconds (default: 600)")
    ap.add_argument("--check", action="store_true", help="Check if Codex CLI is available")
    ap.add_argument("--json", action="store_true", default=True, help="Output as JSON (default)")
    args = ap.parse_args()

    if args.check:
        result = check_codex()
        print(json.dumps(result, indent=2))
        return 0 if result.get("installed") else 1

    if not args.prompt:
        ap.error("--prompt is required (unless using --check)")
        return 1

    result = run_codex_agent(
        prompt=args.prompt,
        workspace=args.workspace,
        model=args.model,
        mode=args.mode,
        timeout_s=args.timeout,
    )

    print(json.dumps(result, indent=2))
    return 0 if result.get("ok") else 1


if __name__ == "__main__":
    sys.exit(main())
