# Workspace Isolation Usage Guide

## 概述 (Overview)

Claw Core 插件現在支援靈活的 workspace 隔離策略，解決多用戶並發使用時的文件衝突問題。

## 配置選項 (Configuration)

在 `openclaw.json` 中配置：

```json
{
  "plugins": {
    "claw-core": {
      "defaultWorkspace": "~/Documents/claw_core",
      "workspaceStrategy": "per-agent",  // 可選: "shared" | "per-agent" | "per-session"
      "workspaceBase": "~/.openclaw/workspaces",
      
      // Skills 管理策略（新增）
      "skillsStrategy": "hybrid",  // 推薦: "hybrid" | "symlink" | "copy" | "none"
      "globalSkillsDir": "~/.openclaw/shared_skills",
      
      // 混合策略配置（當 skillsStrategy = "hybrid"）
      "skillsHybrid": {
        "defaultMode": "symlink",
        "copyForTiers": ["premium", "enterprise"]
      }
    }
  }
}
```

### workspaceStrategy 策略說明

| 策略 | 說明 | 適用場景 |
|------|------|---------|
| `shared` | 所有會話共用 defaultWorkspace | 單用戶環境 |
| `per-agent` | 每個 agent 有獨立 workspace（預設） | Telegram 多機器人設置 |
| `per-session` | 每個會話有獨立 workspace | 多用戶並發環境 |

### skillsStrategy 策略說明（用於 shared_skills/）

| 策略 | 說明 | 磁碟使用 | 適用場景 |
|------|------|---------|---------|
| `symlink` | 所有 workspace 共享一份 skills | 極低（~0 MB） | 標準化環境 |
| `copy` | 每個 workspace 獨立 skills 副本 | 高（N × 15 MB） | 需要客製化 |
| `hybrid` ⭐ | 預設 symlink，按需 copy | 最優（只複製需要的） | **推薦** - 平衡效率與靈活性 |
| `none` | 空的 shared_skills/ 目錄 | 最低 | 測試環境 |

## Workspace 解析優先順序

```
1. 明確傳遞的 workspace 參數 (最高優先級)
   ↓
2. 從 _id 提取的 agent/session 資訊
   ↓
3. pluginConfig.defaultWorkspace
   ↓
4. 空字串 (Cursor 使用當前目錄)
```

## 使用方式

### 方式 1: 明確傳遞 workspace（推薦用於多用戶）

在調用 `cursor_agent_direct` 時明確指定 workspace：

```typescript
// 從你的系統獲取 session ID
const sessionId = getUserSessionId();  // 你的邏輯
const userWorkspace = `~/.openclaw/workspaces/session-${sessionId}`;

// 調用 cursor_agent_direct
await tool.execute({
  prompt: "Generate an image of a cat",
  workspace: userWorkspace  // 明確指定
});
```

### 方式 2: 使用 agent-specific workspace（適用於 Telegram bots）

配置 Telegram bots 時，每個 bot 自動使用獨立 workspace：

```json
{
  "agents": {
    "list": [
      {
        "id": "telegram-bot-artist",
        "workspace": "~/.openclaw/workspace-artist"
      },
      {
        "id": "telegram-bot-developer",
        "workspace": "~/.openclaw/workspace-developer"
      }
    ]
  }
}
```

調用時會自動使用對應的 workspace（如果 `_id` 包含 agent 資訊）。

### 方式 3: 啟用 per-session 策略（實驗性）

```json
{
  "plugins": {
    "claw-core": {
      "workspaceStrategy": "per-session",
      "workspaceBase": "~/.openclaw/workspaces"
    }
  }
}
```

當 `_id` 包含 session 資訊時，會自動建立 `~/.openclaw/workspaces/session-{id}/`

## 推薦：混合策略範例

### 使用 HybridWorkspaceManager（推薦）✨

```javascript
import { HybridWorkspaceManager } from './examples/hybrid-workspace-manager.js';

const manager = new HybridWorkspaceManager();

// 標準用戶 - 自動使用 symlink（節省空間）
const alice = await manager.getWorkspace('alice-123', { tier: 'free' });
// alice.skillsStrategy === 'symlink'

// VIP 用戶 - 自動使用獨立副本（可客製化）
const vip = await manager.getWorkspace('vip-999', { tier: 'premium' });
// vip.skillsStrategy === 'copy'

// 動態升級：用戶需要客製化時
await manager.breakSymlink('alice-123');  // 將 symlink 轉為獨立副本
await manager.addCustomSkill('alice-123', 'custom-skill', skillContent);

// 磁碟使用報告
const report = await manager.generateDiskReport();
console.log(`Disk saved: ${report.diskSaved} MB (${report.efficiency} efficiency)`);
```

**優點**：
- 90% 用戶使用 symlink（幾乎不佔空間）
- 10% 用戶需要時才複製（精確控制）
- 可動態調整（升級/降級）
- 最佳磁碟效率

## 實作範例

### 範例 1: Node.js 編排層 (Orchestrator)

```javascript
// sessionManager.js
class SessionManager {
  constructor() {
    this.sessions = new Map();
  }

  getWorkspaceForSession(sessionId) {
    if (!this.sessions.has(sessionId)) {
      const workspace = `/home/user/.openclaw/workspaces/session-${sessionId}`;
      this.sessions.set(sessionId, { workspace, createdAt: Date.now() });
    }
    return this.sessions.get(sessionId).workspace;
  }

  async callCursorAgent(sessionId, prompt) {
    const workspace = this.getWorkspaceForSession(sessionId);
    
    return await openclaw.tools.cursor_agent_direct.execute({
      prompt: prompt,
      workspace: workspace  // 明確傳遞
    });
  }
}

// 使用
const manager = new SessionManager();
await manager.callCursorAgent("user-alice-123", "Generate image of cat");
await manager.callCursorAgent("user-bob-456", "Generate image of dog");
// 兩個請求使用不同的 workspace，不會衝突
```

### 範例 2: Python 包裝器

```python
# workspace_manager.py
import os
from pathlib import Path

class WorkspaceManager:
    def __init__(self, base_dir="~/.openclaw/workspaces"):
        self.base_dir = Path(base_dir).expanduser()
        self.base_dir.mkdir(parents=True, exist_ok=True)
    
    def get_session_workspace(self, session_id: str) -> str:
        workspace = self.base_dir / f"session-{session_id}"
        workspace.mkdir(parents=True, exist_ok=True)
        
        # 初始化 workspace 結構
        (workspace / "generated" / "images").mkdir(parents=True, exist_ok=True)
        (workspace / "shared_memory").mkdir(parents=True, exist_ok=True)
        (workspace / "shared_skills").mkdir(parents=True, exist_ok=True)
        
        return str(workspace)
    
    async def call_cursor_agent(self, session_id: str, prompt: str):
        workspace = self.get_session_workspace(session_id)
        
        # 調用 OpenClaw tool
        return await openclaw_client.call_tool(
            "cursor_agent_direct",
            {
                "prompt": prompt,
                "workspace": workspace  # 明確傳遞
            }
        )

# 使用
manager = WorkspaceManager()
await manager.call_cursor_agent("alice-123", "Generate cat image")
await manager.call_cursor_agent("bob-456", "Generate dog image")
```

### 範例 3: Telegram Bot 集成

```typescript
// telegram-bot.ts
import TelegramBot from 'node-telegram-bot-api';

const bot = new TelegramBot(TOKEN, { polling: true });

// 為每個 Telegram 用戶維護獨立 workspace
function getUserWorkspace(userId: number): string {
  return `~/.openclaw/workspaces/telegram-user-${userId}`;
}

bot.on('message', async (msg) => {
  const chatId = msg.chat.id;
  const userId = msg.from.id;
  const text = msg.text || '';

  if (text.startsWith('/cursor ')) {
    const prompt = text.substring(8);
    const workspace = getUserWorkspace(userId);

    try {
      const result = await openclaw.callTool('cursor_agent_direct', {
        prompt: prompt,
        workspace: workspace  // 每個用戶獨立 workspace
      });

      bot.sendMessage(chatId, result.output);

      // 如果有生成圖片，發送圖片
      if (result.files_created && result.files_created.length > 0) {
        for (const file of result.files_created) {
          if (file.match(/\.(png|jpg|jpeg|webp|gif)$/i)) {
            bot.sendPhoto(chatId, file);
          }
        }
      }
    } catch (error) {
      bot.sendMessage(chatId, `錯誤: ${error.message}`);
    }
  }
});
```

## Workspace 結構自動初始化

當使用新的 workspace 路徑時，會自動創建以下結構：

```
$WORKSPACE/
├── shared_memory/         # 持久化記憶
├── shared_skills/         # 共享技能
├── projects/              # 項目符號連結
├── generated/             # 生成的輸出
│   ├── images/           # Cursor 生成的圖片
│   └── exports/          # 其他生成文件
├── WORKSPACE.md          # Workspace 說明文件
└── .gitignore            # Git 忽略規則
```

## 清理舊的 Workspace

### 手動清理

```bash
# 列出所有 workspace
ls ~/.openclaw/workspaces/

# 刪除特定 workspace
rm -rf ~/.openclaw/workspaces/session-abc123
```

### 自動清理腳本（未來功能）

```bash
# 清理 7 天前的 workspace
openclaw clawcore clean-workspaces --older-than 7d

# 清理所有 session workspace，保留最近 10 個
openclaw clawcore clean-workspaces --keep-last 10
```

## 故障排除

### 問題 1: Workspace 衝突

**症狀**: 兩個用戶看到對方的文件

**解決**:
```javascript
// 確保每次調用都傳遞 workspace
await tool.execute({
  prompt: "...",
  workspace: deriveUniqueWorkspace(sessionId)  // 必須傳遞
});
```

### 問題 2: Workspace 不存在

**症狀**: Cursor 報錯找不到目錄

**解決**: Workspace 會自動創建，但確保路徑有效：
```javascript
const workspace = path.resolve(path.expanduser(workspacePath));
```

### 問題 3: 權限錯誤

**症狀**: 無法寫入 workspace

**解決**: 確保 OpenClaw 進程有權限：
```bash
chmod -R 755 ~/.openclaw/workspaces
```

## 測試驗證

### 驗證隔離是否有效

```bash
# 終端 1: 用戶 A
curl -X POST http://localhost:18789/api/tool/cursor_agent_direct \
  -d '{"prompt":"Generate cat.png","workspace":"/tmp/workspace-a"}'

# 終端 2: 用戶 B
curl -X POST http://localhost:18789/api/tool/cursor_agent_direct \
  -d '{"prompt":"Generate dog.png","workspace":"/tmp/workspace-b"}'

# 驗證文件位置
ls /tmp/workspace-a/generated/images/  # 應該只有 cat.png
ls /tmp/workspace-b/generated/images/  # 應該只有 dog.png
```

## 最佳實踐

1. **總是明確傳遞 workspace** - 不要依賴自動解析（除非是單用戶環境）
2. **使用一致的命名規則** - 例如 `session-{id}` 或 `user-{id}`
3. **定期清理舊 workspace** - 避免磁碟空間浪費
4. **監控 workspace 使用情況** - 追蹤每個 workspace 的大小和活躍度
5. **備份重要數據** - Workspace 是臨時的，重要數據應該另外保存

## 未來改進

當 OpenClaw 提供 `ToolContext` API 後，workspace 將可以自動解析，無需手動傳遞：

```typescript
// 未來（自動）
async execute(_id, params, context) {
  // context.sessionId 自動可用
  const workspace = autoResolveWorkspace(context);
  // ...
}
```

在此之前，請使用本文檔的方法手動管理 workspace 參數。
