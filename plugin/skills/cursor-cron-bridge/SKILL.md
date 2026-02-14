---
name: cursor-cron-bridge
description: Schedule Cursor agent tasks via OpenClaw cron, monitor execution via Cursor's terminal/transcript files, and report results to Telegram or other channels.
metadata: {"openclaw":{"requires":{"bins":["cursor"]},"emoji":"🔗"}}
---

# Cursor-Cron Bridge

Schedule Cursor agent tasks via cron, monitor long-running sessions, coordinate between OpenClaw cron and Cursor agent.

## Prerequisites

- Cursor CLI: `cursor --version`
- `cursor-cli` registered in `~/.openclaw/openclaw.json` (see `.cursor/docs/examples/openclaw-cursor-cli-config.json`)

## Schedule Cursor via Cron

Use **cron tool** with `agentId: "cursor-dev"` (or your cursor-cli backed agent).

## Monitor Cursor Sessions

Cursor stores files at:
- `~/.cursor/projects/<project-id>/terminals/*.txt`
- `~/.cursor/projects/<project-id>/agent-transcripts/*.jsonl`

**Project ID** = workspace path with `/` → `-`, drop leading `/Users/` or `/home/`.

## Reference

- Full config: `.cursor/docs/examples/openclaw-cursor-cli-config.json`
- Coordination: `.cursor/docs/CRON-CURSOR-COORDINATION.md`
