# PicoClaw Support — File Summary

## Count

**16 files** reference or support PicoClaw in the plugin.

---

## By Category

### 1. Core implementation (3 files)

| File | Role |
|------|------|
| `scripts/picoclaw_client.py` | Python wrapper: chat, status, config, config-set. Finds binary and config. |
| `skills/picoclaw-bridge/SKILL.md` | Skill: when to use `picoclaw_chat`, web search, capabilities. |
| `skills/picoclaw-config/SKILL.md` | Skill: when to use `picoclaw_config`, view/set model, provider, language. |

### 2. Plugin wiring (2 files)

| File | Role |
|------|------|
| `index.ts` | Registers CLI `openclaw picoclaw`, Gateway RPCs `picoclaw.status` / `picoclaw.chat`, tools `picoclaw_chat` and `picoclaw_config`. |
| `openclaw.plugin.json` | Config: `picoClawPath`, `enablePicoClaw`; skills list: `picoclaw-bridge`, `picoclaw-config`. |

### 3. Bot setup & status (2 files)

| File | Role |
|------|------|
| `scripts/setup_bots.py` | Assistant bot: tools include `picoclaw_chat`, `picoclaw_config`; Q&A bot description. |
| `scripts/status_dashboard.py` | Shows PicoClaw binary status and config (model/provider). |

### 4. Agent templates (5 files)

| File | Role |
|------|------|
| `templates/assistant/AGENTS.md` | Assistant: use `picoclaw_chat` for Q&A and web search; `picoclaw_config` for config. |
| `templates/assistant/IDENTITY.md` | Assistant identity: PicoClaw as primary backend. |
| `templates/assistant/SOUL.md` | Assistant soul: PicoClaw for speed and web search. |
| `templates/developer/AGENTS.md` | Developer: use `picoclaw_chat` for quick factual questions. |
| `templates/developer/SOUL.md` | Developer: use PicoClaw for quick factual questions. |

### 5. Other skills (2 files)

| File | Role |
|------|------|
| `skills/multi-backend-router/SKILL.md` | Routing: quick Q&A / web search → PicoClaw; config → `picoclaw_config`. |
| `skills/team-member/SKILL.md` | Team member: assistant uses `picoclaw_chat` for research and Q&A. |

### 6. Docs & package (2 files)

| File | Role |
|------|------|
| `README.md` | PicoClaw features, tools, CLI, config, troubleshooting. |
| `package.json` | Description and keywords mention PicoClaw. |

---

## What the plugin provides for PicoClaw

| Type | Name | Description |
|------|------|-------------|
| **CLI** | `openclaw picoclaw status` | Check if PicoClaw is installed |
| **CLI** | `openclaw picoclaw config` | Show PicoClaw config |
| **CLI** | `openclaw picoclaw chat "<msg>"` | Send message to PicoClaw |
| **Gateway RPC** | `picoclaw.status` | Installation status (JSON) |
| **Gateway RPC** | `picoclaw.chat` | Send message (params: `message`) |
| **Agent tool** | `picoclaw_chat` | Chat with PicoClaw (quick Q&A, web search) |
| **Agent tool** | `picoclaw_config` | View or set PicoClaw config (model, provider, language, etc.) |

---

## Config (openclaw.json)

```json
{
  "plugins": {
    "claw-core": {
      "picoClawPath": "picoclaw",
      "enablePicoClaw": true
    }
  }
}
```

- **picoClawPath**: Binary path (default `picoclaw` from PATH).
- **enablePicoClaw**: When `true`, registers `picoclaw_chat` and `picoclaw_config`; when `false`, they are skipped.

---

## Summary

| Category | File count |
|----------|------------|
| Core (script + PicoClaw skills) | 3 |
| Plugin wiring | 2 |
| Bot setup & status | 2 |
| Agent templates | 5 |
| Other skills | 2 |
| Docs & package | 2 |
| **Total** | **16** |

All of these together implement and document PicoClaw integration (CLI, RPC, tools, assistant/developer bots, and routing).
