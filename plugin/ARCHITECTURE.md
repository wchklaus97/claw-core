# Claw Core Architecture: Workspace Isolation

## Problem Statement

**Issue 1**: SKILL.md files contain hardcoded workspace paths (`~/Documents/claw_core/`) that conflict when workspaces change.

**Issue 2**: Single `defaultWorkspace` serves all chat sessions, causing file collisions and security issues in multi-user scenarios.

## Solution: Multi-Level Workspace Strategy

### 1. Workspace Hierarchy

```
Level 1: Agent-specific workspaces (Telegram bots)
├── ~/.openclaw/workspace-{bot_id}/          # Per-bot isolation
│   ├── shared_memory/
│   ├── shared_skills/
│   ├── projects/
│   └── generated/
│       └── images/

Level 2: Session-specific workspaces (future)
├── ~/.openclaw/workspace-session-{session_id}/  # Per-chat isolation
│   └── (same structure)

Level 3: Default workspace (cursor-dev, single-user)
└── ~/Documents/claw_core/                   # Default for main agent
    ├── shared_memory/
    ├── shared_skills/
    ├── projects/
    └── generated/
        └── images/
```

### 2. Workspace Resolution Order

```typescript
function resolveWorkspace(params, context, pluginConfig) {
  // 1. Explicit parameter (highest priority)
  if (params.workspace) return params.workspace;
  
  // 2. Session-derived workspace (multi-user isolation)
  if (context.agentId && context.agentId !== "cursor-dev") {
    return `~/.openclaw/workspace-${context.agentId}`;
  }
  
  // 3. Default workspace (single-user fallback)
  return pluginConfig.defaultWorkspace || "~/Documents/claw_core";
}
```

### 3. Dynamic Skill Documentation

**Replace hardcoded paths** with dynamic placeholders:

#### Before (hardcoded):
```markdown
Default workspace: `~/Documents/claw_core/generated/images/`
Bot-specific workspaces: `~/.openclaw/workspace-{bot_id}/generated/images/`
```

#### After (dynamic):
```markdown
Workspace structure: `$WORKSPACE/generated/images/`

Where `$WORKSPACE` is:
- **Main agent (cursor-dev)**: `~/Documents/claw_core/` (configurable via `defaultWorkspace`)
- **Telegram bots**: `~/.openclaw/workspace-{bot_id}/`
- **Custom agents**: Defined in agent config or passed via `workspace` parameter
```

## Implementation Plan

### Phase 1: Remove Hardcoded Paths (Immediate)
- [x] Identify all SKILL.md files with hardcoded paths
- [ ] Replace with `$WORKSPACE` placeholder or relative paths
- [ ] Add workspace resolution section to each skill

### Phase 2: Per-Agent Workspace Support (Current)
- [x] Telegram bots use `~/.openclaw/workspace-{bot_id}/`
- [ ] Derive workspace from agent context in tools
- [ ] Update `cursor_agent_direct` tool to use agent-specific workspace

### Phase 3: Per-Session Workspace (Future)
- [ ] Add `context.sessionId` to tool execution
- [ ] Create `~/.openclaw/workspace-session-{session_id}/` on first use
- [ ] Implement workspace cleanup for expired sessions
- [ ] Add `workspaceStrategy` config option: `shared` | `per-agent` | `per-session`

## Configuration Options

```json
{
  "plugins": {
    "claw-core": {
      "defaultWorkspace": "~/Documents/claw_core",
      "workspaceStrategy": "per-agent",  // New option
      "workspaceBase": "~/.openclaw/workspaces",  // New option
      "sessionWorkspaceCleanupDays": 7  // New option
    }
  }
}
```

## Migration Guide

### For Users
- **No action required** for single-user setups
- Multi-bot setups already use per-bot workspaces
- Future: Enable `workspaceStrategy: "per-session"` for multi-user isolation

### For Skill Authors
- Use `$WORKSPACE` instead of absolute paths
- Use relative paths within workspace: `generated/images/` not `/full/path/to/images/`
- Document workspace requirements in skill metadata

## Open Questions

1. **Context availability**: Does OpenClaw provide `agentId` or `sessionId` in tool `execute()` context?
   - **Current**: Only `_id` string parameter (unclear format)
   - **Need**: Access to `context.agentId`, `context.sessionId`, `context.accountId`

2. **Workspace lifecycle**: How to clean up abandoned session workspaces?
   - Option A: TTL-based cleanup (7 days inactive)
   - Option B: Manual cleanup command
   - Option C: Gateway manages lifecycle

3. **Backward compatibility**: How to handle existing deployments?
   - **Proposal**: Default to `workspaceStrategy: "shared"` (current behavior)
   - Users opt-in to `per-agent` or `per-session`
