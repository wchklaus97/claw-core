#!/usr/bin/env python3
"""
Direct Cursor Agent CLI wrapper for OpenClaw plugin.

Invokes `cursor agent` with structured JSON output, timeout handling,
and image file detection. Designed to be called by the claw-core plugin
as an agent tool backend.

Usage:
  cursor_agent_direct.py --prompt "..." [--workspace /path] [--model auto] [--timeout 600]
  cursor_agent_direct.py --help
  cursor_agent_direct.py --check   # Check if Cursor CLI is available

Output (JSON):
  { "ok": true, "output": "...", "exit_code": 0, "duration_ms": 1234,
    "files_created": ["/path/to/image.png"], "truncated": false }
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


def find_cursor_binary() -> str | None:
    """Locate the Cursor CLI binary."""
    custom = os.environ.get("CURSOR_PATH")
    if custom and shutil.which(custom):
        return custom
    if shutil.which("cursor"):
        return "cursor"
    # Common install locations
    for candidate in [
        os.path.expanduser("~/.local/bin/cursor"),
        "/usr/local/bin/cursor",
        "/usr/bin/cursor",
    ]:
        if os.path.isfile(candidate) and os.access(candidate, os.X_OK):
            return candidate
    return None


def check_cursor() -> dict:
    """Check if Cursor CLI is installed and return version info."""
    binary = find_cursor_binary()
    if not binary:
        return {"installed": False, "error": "cursor CLI not found on PATH"}
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
    """Detect files created during the Cursor run (especially images in assets/)."""
    new_files: list[str] = []
    # Check common image output locations
    for pattern in [
        os.path.join(workspace, "assets", "**", "*"),
        os.path.join(workspace, "**", "*.png"),
        os.path.join(workspace, "**", "*.jpg"),
        os.path.join(workspace, "**", "*.jpeg"),
        os.path.join(workspace, "**", "*.webp"),
        os.path.join(workspace, "**", "*.svg"),
    ]:
        for path in glob.glob(pattern, recursive=True):
            if path not in before_files and os.path.isfile(path):
                new_files.append(path)
    return sorted(set(new_files))


def snapshot_files(workspace: str) -> set[str]:
    """Take a snapshot of image-like files in the workspace."""
    files: set[str] = set()
    for pattern in [
        os.path.join(workspace, "assets", "**", "*"),
        os.path.join(workspace, "**", "*.png"),
        os.path.join(workspace, "**", "*.jpg"),
        os.path.join(workspace, "**", "*.jpeg"),
        os.path.join(workspace, "**", "*.webp"),
        os.path.join(workspace, "**", "*.svg"),
    ]:
        for path in glob.glob(pattern, recursive=True):
            if os.path.isfile(path):
                files.add(path)
    return files


def run_cursor_agent(
    prompt: str,
    workspace: str | None = None,
    model: str = "auto",
    timeout_s: int = 600,
) -> dict:
    """Run cursor agent and return structured result."""
    binary = find_cursor_binary()
    if not binary:
        return {
            "ok": False,
            "error": "cursor CLI not found. Install Cursor and ensure it is on PATH.",
            "exit_code": -1,
            "output": "",
            "duration_ms": 0,
            "files_created": [],
            "truncated": False,
        }

    cmd = [binary, "agent", prompt, "--print"]

    if model and model != "auto":
        cmd.extend(["--model", model])

    if workspace:
        cmd.extend(["--workspace", workspace])

    effective_workspace = workspace or os.getcwd()

    # Snapshot files before run to detect new ones
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

        output = result.stdout or ""
        stderr = result.stderr or ""

        # Combine stdout and stderr if stderr has content
        if stderr and stderr.strip():
            output = output + "\n--- stderr ---\n" + stderr

        truncated = False
        if len(output) > MAX_OUTPUT_BYTES:
            output = output[:MAX_OUTPUT_BYTES] + f"\n\n... [truncated at {MAX_OUTPUT_BYTES // 1024}KB]"
            truncated = True

        # Detect newly created files
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
            "error": f"cursor agent timed out after {timeout_s}s",
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
        description="Direct Cursor Agent CLI wrapper. Invokes cursor agent with structured JSON output.",
    )
    ap.add_argument("--prompt", help="Prompt to send to Cursor Agent")
    ap.add_argument("--workspace", default=None, help="Workspace path for Cursor")
    ap.add_argument("--model", default="auto", help="Model to use (default: auto)")
    ap.add_argument("--timeout", type=int, default=600, help="Timeout in seconds (default: 600)")
    ap.add_argument("--check", action="store_true", help="Check if Cursor CLI is available")
    ap.add_argument("--json", action="store_true", default=True, help="Output as JSON (default)")
    args = ap.parse_args()

    if args.check:
        result = check_cursor()
        print(json.dumps(result, indent=2))
        return 0 if result.get("installed") else 1

    if not args.prompt:
        ap.error("--prompt is required (unless using --check)")
        return 1

    result = run_cursor_agent(
        prompt=args.prompt,
        workspace=args.workspace,
        model=args.model,
        timeout_s=args.timeout,
    )

    print(json.dumps(result, indent=2))
    return 0 if result.get("ok") else 1


if __name__ == "__main__":
    sys.exit(main())
