# Workspace Issues Summary

## Issues Identified

### Issue 1: Hardcoded Workspace Paths ✅ FIXED
**Problem**: Skills contained hardcoded references to `~/Documents/claw_core/` that would conflict when workspace changes.

**Files affected**:
- `skills/image-via-cursor/SKILL.md`
- `skills/claw-core-workspace/SKILL.md`
- `skills/cursor-setup/SKILL.md`

**Solution**: Replaced all hardcoded paths with `$WORKSPACE` placeholder and documented workspace resolution by agent type.

**Changes**:
- Used `$WORKSPACE/generated/images/` instead of absolute paths
- Added "Workspace Location by Agent" tables
- Clarified that workspace location varies by agent context

### Issue 2: Single Workspace for Multiple Chats ⏳ DESIGNED
**Problem**: All chat sessions share the same `defaultWorkspace`, causing:
- File naming collisions
- Memory pollution between users
- Security issues (users see each other's files)

**Current behavior**:
```typescript
// Only one workspace fallback for all sessions
const workspace = params.workspace || pluginConfig.defaultWorkspace || "";
```

**Proposed solution**: Three-tier workspace strategy
1. **Agent-level** (current, works for bots): `~/.openclaw/workspace-{bot_id}/`
2. **Session-level** (proposed): `~/.openclaw/workspaces/session-{session_id}/`
3. **Account-level** (future): `~/.openclaw/workspaces/user-{account_hash}/`

**Blocker**: Tools need access to session context (`agentId`, `sessionId`, `accountId`) in `execute()` function.

Current signature:
```typescript
async execute(_id: string, params: Record<string, unknown>)
```

Needed:
```typescript
async execute(_id: string, params: Record<string, unknown>, context?: ToolContext)
```

## Documentation Created

### 1. `plugin/ARCHITECTURE.md`
High-level overview of workspace isolation strategy, configuration options, and implementation phases.

### 2. `plugin/docs/WORKSPACE_ISOLATION.md`
Detailed technical specification including:
- Problem scenarios with examples
- Workspace resolution logic (code)
- Configuration schema
- Auto-initialization implementation
- Migration path (4 phases)
- Testing strategy
- Workarounds until OpenClaw provides context API
- Open questions for OpenClaw team

## What Works Now (v0.3.0)

✅ **Per-bot workspaces**: Each Telegram bot has isolated workspace
✅ **Dynamic skill documentation**: No more hardcoded paths
✅ **Manual override**: Tools accept explicit `workspace` parameter
✅ **Clear documentation**: Users understand workspace varies by agent

## What's Blocked

❌ **Per-session isolation**: Requires `ToolContext` from OpenClaw
❌ **Multi-user support**: Currently one `defaultWorkspace` serves all
❌ **Auto workspace cleanup**: Can't identify abandoned sessions without session context

## Next Steps

### Immediate (You can do now)
1. Review the documentation in `plugin/ARCHITECTURE.md` and `plugin/docs/WORKSPACE_ISOLATION.md`
2. Decide on workspace strategy for your use case:
   - **Single user**: Current `defaultWorkspace` is fine
   - **Multi-bot**: Already works with per-bot workspaces
   - **Multi-user**: Need to file feature request with OpenClaw

### Short-term (v0.4.0)
1. File feature request with OpenClaw for `ToolContext` in tool execution
2. Document use cases and requirements
3. Propose backward-compatible API extension

### Mid-term (v0.5.0 - after OpenClaw support)
1. Implement `workspaceStrategy` configuration
2. Update `cursor_agent_direct` and other tools to use context-aware workspace resolution
3. Add auto-initialization for new workspaces
4. Implement cleanup job for old session workspaces

## Workarounds (Until Official Support)

### Option 1: Always pass `workspace` parameter
Have agents/orchestrator explicitly pass workspace on every tool call:
```json
{
  "tool": "cursor_agent_direct",
  "params": {
    "prompt": "Generate image",
    "workspace": "/home/user/.openclaw/workspaces/session-abc123"
  }
}
```

### Option 2: One agent per user
Create a dedicated agent config for each user:
```json
{
  "agents": {
    "list": [
      {
        "id": "user-alice",
        "workspace": "~/.openclaw/workspaces/alice"
      },
      {
        "id": "user-bob",
        "workspace": "~/.openclaw/workspaces/bob"
      }
    ]
  }
}
```

### Option 3: Parse `_id` parameter (if it contains context)
If OpenClaw's `_id` parameter contains session/agent info, extract it:
```typescript
function parseToolId(_id: string): { agentId?: string, sessionId?: string } {
  // Parse _id format and extract identifiers
  // Example: "_id" could be "agent:bot-artist:session:abc123"
}
```

## Questions?

- **Is per-session isolation needed for your use case?** If yes, which workaround fits best?
- **Should we file the OpenClaw feature request now?** I can draft it with full specification.
- **Want to test current per-bot workspace behavior?** I can add test scenarios.
