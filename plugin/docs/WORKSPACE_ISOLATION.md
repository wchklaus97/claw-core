# Workspace Isolation Strategy

## Current State (v0.3.0)

### What Works
- ✅ **Per-bot workspaces**: Telegram bots use `~/.openclaw/workspace-{bot_id}/`
- ✅ **Default workspace**: Main `cursor-dev` agent uses `~/Documents/claw_core/`
- ✅ **Manual override**: Tools accept `workspace` parameter for explicit control

### What Doesn't Work
- ❌ **Multi-user isolation**: Multiple users/chats share the same `defaultWorkspace`
- ❌ **Concurrent sessions**: Parallel sessions collide in file operations
- ❌ **Security**: One session can see/modify another session's files

## Problem Scenarios

### Scenario 1: Multiple Users on Same Agent
```
User A: "Generate an image of a cat" → saves to ~/Documents/claw_core/generated/images/cat.png
User B: "Generate an image of a dog" → overwrites ~/Documents/claw_core/generated/images/cat.png (if same name)
User A: Receives wrong image or error
```

### Scenario 2: Concurrent Requests
```
Session 1: Cursor working on project A in ~/Documents/claw_core/projects/A/
Session 2: Cursor working on project B in ~/Documents/claw_core/projects/B/
Both sessions share the same shared_memory/ → memory pollution
```

## Proposed Solution: Three-Tier Workspace Strategy

### Tier 1: Agent-Level (Current - Works)
```
Agent: telegram-bot-artist
Workspace: ~/.openclaw/workspace-artist/
Isolation: Per-bot (all users of bot share workspace)
```

### Tier 2: Session-Level (Proposed)
```
Agent: cursor-dev
Session: session-abc123
Workspace: ~/.openclaw/workspaces/session-abc123/
Isolation: Per-session (each chat gets own workspace)
```

### Tier 3: Account-Level (Future)
```
Agent: cursor-dev
Account: user@example.com
Workspace: ~/.openclaw/workspaces/user-hash-abc/
Isolation: Per-account (user's sessions share workspace)
```

## Implementation Requirements

### 1. Context Access in Tool Execute

**Current signature:**
```typescript
async execute(_id: string, params: Record<string, unknown>)
```

**Need:**
```typescript
interface ToolContext {
  agentId: string;
  sessionId: string;
  accountId?: string;
  channelId?: string;
  _channel?: string;
  _accountId?: string;
}

async execute(_id: string, params: Record<string, unknown>, context: ToolContext)
```

### 2. Workspace Resolution Logic

```typescript
function resolveWorkspace(
  params: Record<string, unknown>,
  context: ToolContext,
  pluginConfig: ClawCoreConfig
): string {
  // Priority 1: Explicit parameter (highest)
  if (params.workspace) {
    return expandPath(params.workspace as string);
  }

  // Priority 2: Agent-specific workspace
  if (context.agentId && context.agentId !== "main" && context.agentId !== "cursor-dev") {
    const agentWorkspace = `~/.openclaw/workspace-${context.agentId}`;
    return expandPath(agentWorkspace);
  }

  // Priority 3: Session-specific workspace (if enabled)
  if (pluginConfig.workspaceStrategy === "per-session" && context.sessionId) {
    const sessionWorkspace = `${pluginConfig.workspaceBase || "~/.openclaw/workspaces"}/session-${context.sessionId}`;
    return expandPath(sessionWorkspace);
  }

  // Priority 4: Account-specific workspace (if enabled)
  if (pluginConfig.workspaceStrategy === "per-account" && context.accountId) {
    const accountHash = hashAccountId(context.accountId);
    const accountWorkspace = `${pluginConfig.workspaceBase || "~/.openclaw/workspaces"}/user-${accountHash}`;
    return expandPath(accountWorkspace);
  }

  // Priority 5: Default workspace (fallback)
  return expandPath(pluginConfig.defaultWorkspace || "~/Documents/claw_core");
}
```

### 3. Configuration Schema

```json
{
  "plugins": {
    "claw-core": {
      "defaultWorkspace": "~/Documents/claw_core",
      "workspaceStrategy": "shared",  // "shared" | "per-agent" | "per-session" | "per-account"
      "workspaceBase": "~/.openclaw/workspaces",
      "sessionWorkspaceCleanup": {
        "enabled": true,
        "inactiveDays": 7,
        "keepCount": 10  // Keep last N sessions even if older
      }
    }
  }
}
```

### 4. Auto-initialization

```typescript
async function ensureWorkspace(workspacePath: string): Promise<void> {
  const expanded = expandPath(workspacePath);
  
  // Create workspace structure if missing
  const dirs = [
    expanded,
    path.join(expanded, "shared_memory"),
    path.join(expanded, "shared_skills"),
    path.join(expanded, "projects"),
    path.join(expanded, "generated"),
    path.join(expanded, "generated/images"),
    path.join(expanded, "generated/exports")
  ];

  for (const dir of dirs) {
    await fs.promises.mkdir(dir, { recursive: true });
  }

  // Copy template files if this is a new workspace
  const workspaceReadme = path.join(expanded, "WORKSPACE.md");
  if (!existsSync(workspaceReadme)) {
    await copyTemplateFile("WORKSPACE.md", workspaceReadme);
  }

  const gitignore = path.join(expanded, ".gitignore");
  if (!existsSync(gitignore)) {
    await copyTemplateFile(".gitignore", gitignore);
  }
}
```

## Migration Path

### Phase 1: Fix Hardcoded Paths (v0.3.1) ✅
- [x] Replace hardcoded `~/Documents/claw_core/` with `$WORKSPACE` in skills
- [x] Document workspace resolution in ARCHITECTURE.md
- [x] Add workspace location tables to relevant skills

### Phase 2: Request OpenClaw Context API (v0.4.0)
- [ ] File feature request with OpenClaw for `ToolContext` in `execute()`
- [ ] Document required fields: `agentId`, `sessionId`, `accountId`, `channelId`
- [ ] Propose backward-compatible signature: `execute(_id, params, context?)`

### Phase 3: Implement Per-Session Workspaces (v0.5.0)
- [ ] Add `workspaceStrategy` config option
- [ ] Implement `resolveWorkspace()` function
- [ ] Update all tools to use `resolveWorkspace()`
- [ ] Add workspace auto-initialization
- [ ] Add cleanup job for old session workspaces

### Phase 4: Add Workspace Management CLI (v0.6.0)
- [ ] `openclaw clawcore list-workspaces` - Show all workspaces
- [ ] `openclaw clawcore clean-workspaces --older-than 7d` - Cleanup
- [ ] `openclaw clawcore workspace-status <session-id>` - Show usage stats

## Workarounds (Until Context API Available)

### Option A: Derive from `_id` parameter
If `_id` contains session/agent info in a parseable format:
```typescript
function parseToolId(_id: string): { agentId?: string, sessionId?: string } {
  // Example: "_id": "agent:telegram-bot-artist:session:abc123"
  // Parse and extract identifiers
}
```

### Option B: Environment Variables
OpenClaw could set environment variables before tool execution:
```bash
OPENCLAW_AGENT_ID=telegram-bot-artist
OPENCLAW_SESSION_ID=abc123
OPENCLAW_ACCOUNT_ID=user@example.com
```

### Option C: Require Explicit Workspace
Document that multi-user deployments **must** pass `workspace` parameter:
```typescript
// In agent system prompt or tool descriptions
"When multiple users may use this tool concurrently, always include the workspace parameter derived from the session context."
```

## Testing Strategy

### Unit Tests
- Workspace resolution logic
- Path expansion and normalization
- Configuration validation

### Integration Tests
```typescript
describe("Workspace Isolation", () => {
  it("should isolate sessions with per-session strategy", async () => {
    const session1 = await createSession("user-a");
    const session2 = await createSession("user-b");

    await session1.call("cursor_agent_direct", {
      prompt: "Generate image of cat"
    });

    await session2.call("cursor_agent_direct", {
      prompt: "Generate image of dog"
    });

    // Verify images saved to different workspaces
    const ws1Files = await listFiles(session1.workspace);
    const ws2Files = await listFiles(session2.workspace);

    expect(ws1Files).toContain("cat.png");
    expect(ws2Files).toContain("dog.png");
    expect(ws1Files).not.toContain("dog.png");
    expect(ws2Files).not.toContain("cat.png");
  });
});
```

## Open Questions for OpenClaw Team

1. **Context API**: Can `execute()` signature be extended to include `ToolContext`?
2. **Backward compatibility**: Should this be opt-in via plugin API version?
3. **Workspace lifecycle**: Should gateway manage workspace cleanup or plugins?
4. **Shared state**: How should plugins share state across sessions (if needed)?
5. **Security**: Should workspace paths be validated/sandboxed by gateway?

## References

- [OpenClaw Session Management](https://docs.openclaw.ai/concepts/session)
- [OpenClaw Tools](https://docs.openclaw.ai/tools)
- [Plugin Architecture](../ARCHITECTURE.md)
