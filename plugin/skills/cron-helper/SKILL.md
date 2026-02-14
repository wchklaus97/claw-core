---
name: cron-helper
description: Simple cron job creation via exec (avoids complex cron tool params). Use when user wants to schedule Cursor or Claw Core tasks and deliver results to Telegram.
metadata: {"openclaw":{"requires":{"bins":[]},"emoji":"⏰"}}
---

# Cron Helper — Simple Scheduling via Exec

Use this when the user asks to **create cron jobs** (schedule Cursor tasks, claw_core session commands, etc.) and you want to **avoid** the complex `cron` tool parameters.

## When to use

- User says: "每早 9:00 用 Cursor 檢查依賴並傳到 Telegram"
- User wants to schedule ANY task with Telegram delivery

## How to use

**Script path:** `$PLUGIN_ROOT/scripts/cron_helper.py` or `$CLAW_ROOT/scripts/cron_helper.py`

### Add daily Cursor job (9am)

```bash
python3 $PLUGIN_ROOT/scripts/cron_helper.py add-cursor-daily \
  --name "每早檢查依賴" \
  --hour 9 \
  --message "用 Cursor 做：檢查 workspace 的 package.json，列出過期套件。" \
  --telegram-chat "CHAT_ID"
```

### List / Remove jobs

```bash
python3 $PLUGIN_ROOT/scripts/cron_helper.py list
python3 $PLUGIN_ROOT/scripts/cron_helper.py remove --job-id job-abc123...
```

## Env

- `$PLUGIN_ROOT` — plugin install dir (`~/.openclaw/extensions/claw-core`)
- `$CLAW_ROOT` — claw repo (if using repo scripts)
