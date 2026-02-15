#!/usr/bin/env python3
"""
PicoClaw CLI wrapper for OpenClaw plugin.

Provides a structured interface to PicoClaw (https://github.com/sipeed/picoclaw),
an ultra-lightweight AI assistant. Designed to be called by the claw-core plugin
as an agent tool backend.

Usage:
  picoclaw_client.py chat --message "..." [--json]
  picoclaw_client.py status [--json]
  picoclaw_client.py config [--json]
  picoclaw_client.py config-set --key model --value deepseek-chat [--json]
  picoclaw_client.py --help

Subcommands:
  chat        Send a message to PicoClaw agent
  status      Check if PicoClaw is installed and show info
  config      Show current PicoClaw configuration
  config-set  Update a PicoClaw configuration field
"""
from __future__ import annotations

import argparse
import json
import os
import shutil
import subprocess
import sys
import time
from pathlib import Path

# Standard PicoClaw config locations
PICOCLAW_CONFIG_PATHS = [
    Path.home() / ".picoclaw" / "workspace" / "config.json",
    Path.home() / ".picoclaw" / "config.json",
]

MAX_OUTPUT_BYTES = 100 * 1024  # 100 KB


def find_picoclaw_binary() -> str | None:
    """Locate the PicoClaw binary."""
    custom = os.environ.get("PICOCLAW_PATH")
    if custom and shutil.which(custom):
        return custom
    if shutil.which("picoclaw"):
        return "picoclaw"
    if shutil.which("pico"):
        return "pico"
    # Common install locations
    for candidate in [
        os.path.expanduser("~/go/bin/picoclaw"),
        "/usr/local/bin/picoclaw",
        "/usr/bin/picoclaw",
        os.path.expanduser("~/.local/bin/picoclaw"),
    ]:
        if os.path.isfile(candidate) and os.access(candidate, os.X_OK):
            return candidate
    return None


def find_config_path() -> Path | None:
    """Find the PicoClaw config file."""
    for path in PICOCLAW_CONFIG_PATHS:
        if path.exists():
            return path
    return None


def read_config() -> dict:
    """Read PicoClaw configuration."""
    config_path = find_config_path()
    if not config_path:
        return {"error": "config file not found", "searched": [str(p) for p in PICOCLAW_CONFIG_PATHS]}
    try:
        with open(config_path, "r") as f:
            config = json.load(f)
        # Redact API key for display
        safe_config = dict(config)
        if "api_key" in safe_config and safe_config["api_key"]:
            key = safe_config["api_key"]
            safe_config["api_key"] = key[:8] + "..." + key[-4:] if len(key) > 12 else "***"
        safe_config["_config_path"] = str(config_path)
        return safe_config
    except json.JSONDecodeError as exc:
        return {"error": f"invalid JSON in config: {exc}", "path": str(config_path)}
    except Exception as exc:
        return {"error": str(exc), "path": str(config_path)}


def write_config_field(key: str, value: str) -> dict:
    """Update a single field in PicoClaw config."""
    config_path = find_config_path()
    if not config_path:
        # Create default config at first standard path
        config_path = PICOCLAW_CONFIG_PATHS[0]
        config_path.parent.mkdir(parents=True, exist_ok=True)
        config = {}
    else:
        try:
            with open(config_path, "r") as f:
                config = json.load(f)
        except Exception:
            config = {}

    old_value = config.get(key)
    # Try to parse value as JSON for non-string types
    try:
        parsed = json.loads(value)
        config[key] = parsed
    except (json.JSONDecodeError, TypeError):
        config[key] = value

    try:
        with open(config_path, "w") as f:
            json.dump(config, f, indent=2)
        return {
            "ok": True,
            "path": str(config_path),
            "key": key,
            "old_value": old_value,
            "new_value": config[key],
        }
    except Exception as exc:
        return {"ok": False, "error": str(exc)}


def cmd_status(as_json: bool = True) -> dict:
    """Check PicoClaw installation status."""
    binary = find_picoclaw_binary()
    if not binary:
        result = {
            "installed": False,
            "error": "picoclaw not found on PATH",
            "install_hint": "See https://github.com/sipeed/picoclaw for installation",
        }
        if as_json:
            return result
        print("✗ PicoClaw not installed")
        print(f"  Install: {result['install_hint']}")
        return result

    # Get version
    version = "unknown"
    try:
        proc = subprocess.run(
            [binary, "--version"],
            capture_output=True,
            text=True,
            timeout=5,
        )
        version = proc.stdout.strip() or proc.stderr.strip() or "unknown"
    except Exception:
        pass

    # Read config for model/provider info
    config = read_config()
    model = config.get("model", "unknown")
    base_url = config.get("base_url", "unknown")
    language = config.get("language", "unknown")

    result = {
        "installed": True,
        "binary": binary,
        "version": version,
        "model": model,
        "base_url": base_url,
        "language": language,
        "config_path": config.get("_config_path", "not found"),
    }

    if not as_json:
        print(f"✓ PicoClaw installed: {binary}")
        print(f"  Version:  {version}")
        print(f"  Model:    {model}")
        print(f"  Base URL: {base_url}")
        print(f"  Language: {language}")

    return result


def cmd_chat(message: str, timeout_s: int = 120) -> dict:
    """Send a message to PicoClaw agent."""
    binary = find_picoclaw_binary()
    if not binary:
        return {
            "ok": False,
            "error": "picoclaw not found. Install from https://github.com/sipeed/picoclaw",
            "response": "",
            "duration_ms": 0,
        }

    cmd = [binary, "agent", "-m", message]
    start_time = time.monotonic()

    try:
        result = subprocess.run(
            cmd,
            capture_output=True,
            text=True,
            timeout=timeout_s,
        )
        duration_ms = int((time.monotonic() - start_time) * 1000)

        output = result.stdout or ""
        stderr = result.stderr or ""

        # PicoClaw may output to stdout or stderr depending on version
        response = output.strip()
        if not response and stderr.strip():
            response = stderr.strip()

        truncated = False
        if len(response) > MAX_OUTPUT_BYTES:
            response = response[:MAX_OUTPUT_BYTES] + f"\n\n... [truncated at {MAX_OUTPUT_BYTES // 1024}KB]"
            truncated = True

        return {
            "ok": result.returncode == 0,
            "response": response,
            "exit_code": result.returncode,
            "duration_ms": duration_ms,
            "truncated": truncated,
        }

    except subprocess.TimeoutExpired:
        duration_ms = int((time.monotonic() - start_time) * 1000)
        return {
            "ok": False,
            "error": f"picoclaw timed out after {timeout_s}s",
            "response": "",
            "exit_code": -1,
            "duration_ms": duration_ms,
            "truncated": False,
        }
    except Exception as exc:
        duration_ms = int((time.monotonic() - start_time) * 1000)
        return {
            "ok": False,
            "error": str(exc),
            "response": "",
            "exit_code": -1,
            "duration_ms": duration_ms,
            "truncated": False,
        }


def main() -> int:
    ap = argparse.ArgumentParser(
        description="PicoClaw CLI wrapper for OpenClaw claw-core plugin.",
    )
    sub = ap.add_subparsers(dest="cmd", required=True)

    # chat
    p_chat = sub.add_parser("chat", help="Send a message to PicoClaw agent")
    p_chat.add_argument("--message", "-m", required=True, help="Message to send")
    p_chat.add_argument("--timeout", type=int, default=120, help="Timeout in seconds (default: 120)")
    p_chat.add_argument("--json", action="store_true", default=True, help="Output as JSON")

    # status
    p_status = sub.add_parser("status", help="Check PicoClaw installation status")
    p_status.add_argument("--json", action="store_true", default=True, help="Output as JSON")

    # config
    p_config = sub.add_parser("config", help="Show PicoClaw configuration")
    p_config.add_argument("--json", action="store_true", default=True, help="Output as JSON")

    # config-set
    p_config_set = sub.add_parser("config-set", help="Update a PicoClaw config field")
    p_config_set.add_argument("--key", "-k", required=True, help="Config key to set")
    p_config_set.add_argument("--value", "-v", required=True, help="Value to set")
    p_config_set.add_argument("--json", action="store_true", default=True, help="Output as JSON")

    args = ap.parse_args()

    if args.cmd == "status":
        result = cmd_status(as_json=True)
        print(json.dumps(result, indent=2))
        return 0 if result.get("installed") else 1

    elif args.cmd == "chat":
        result = cmd_chat(message=args.message, timeout_s=args.timeout)
        print(json.dumps(result, indent=2))
        return 0 if result.get("ok") else 1

    elif args.cmd == "config":
        result = read_config()
        print(json.dumps(result, indent=2))
        return 0 if "error" not in result else 1

    elif args.cmd == "config-set":
        result = write_config_field(key=args.key, value=args.value)
        print(json.dumps(result, indent=2))
        return 0 if result.get("ok") else 1

    return 0


if __name__ == "__main__":
    sys.exit(main())
