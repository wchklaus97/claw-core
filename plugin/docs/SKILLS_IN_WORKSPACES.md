# Skills 在多 Workspace 環境中的處理策略

## 問題說明

當使用多個 workspace（per-session 或 per-agent）時，每個 workspace 都需要 `shared_skills/` 目錄。這引發了一個設計問題：

**Skills 應該如何管理？**

## 三種策略比較

### 策略 1: Symlink（符號連結）- 推薦 ✨

所有 workspace 的 `shared_skills/` 指向同一個共享目錄。

```
~/.openclaw/
├── shared_skills/                    # 主 skills 目錄
│   ├── brainstorming/
│   ├── test-driven-development/
│   ├── systematic-debugging/
│   └── ...
└── workspaces/
    ├── session-abc/
    │   └── shared_skills -> ~/.openclaw/shared_skills  # Symlink
    ├── session-def/
    │   └── shared_skills -> ~/.openclaw/shared_skills  # Symlink
    └── session-ghi/
        └── shared_skills -> ~/.openclaw/shared_skills  # Symlink
```

#### 優點 ✅
- **節省空間**: 只存一份 skills（約 10-20 MB），不是 N 份
- **自動同步**: 更新主 skills 目錄，所有 workspace 立即生效
- **維護簡單**: 只需管理一個 skills 目錄
- **一致性**: 所有 workspace 使用相同版本的 skills

#### 缺點 ❌
- **無法客製化**: 每個 session 不能有獨特的 skills
- **共享狀態**: 如果 skill 寫入狀態（不應該），會影響其他 session

#### 適用場景 🎯
- 標準化的多用戶環境
- SaaS 產品（所有用戶相同功能）
- 磁碟空間有限
- Skills 更新頻繁

---

### 策略 2: Copy（完整複製）

每個 workspace 有獨立的 skills 副本。

```
~/.openclaw/workspaces/
├── session-abc/
│   └── shared_skills/           # 完整副本
│       ├── brainstorming/
│       ├── test-driven-development/
│       └── ...
├── session-def/
│   └── shared_skills/           # 完整副本
│       ├── brainstorming/
│       ├── test-driven-development/
│       └── ...
```

#### 優點 ✅
- **完全隔離**: 每個 session 完全獨立
- **可客製化**: 可以為特定 session 添加/修改 skills
- **安全**: 不會意外影響其他 session

#### 缺點 ❌
- **浪費空間**: 100 個 session = 1-2 GB 重複 skills
- **更新困難**: 需要更新每個 workspace
- **不一致**: 不同 session 可能有不同版本的 skills

#### 適用場景 🎯
- 需要高度客製化的企業用戶
- Session 數量少（< 10）
- 磁碟空間充足
- 每個用戶有獨特需求

---

### 策略 3: None（空目錄）

創建空的 `shared_skills/` 目錄，不預安裝任何 skills。

```
~/.openclaw/workspaces/
├── session-abc/
│   └── shared_skills/           # 空
└── session-def/
    └── shared_skills/           # 空
```

#### 優點 ✅
- **極簡**: 不佔用額外空間
- **快速初始化**: 創建 workspace 非常快

#### 缺點 ❌
- **無 skills 可用**: Cursor agent 無法使用 workflow skills
- **需要手動安裝**: 用戶必須自己添加 skills

#### 適用場景 🎯
- 測試/開發環境
- 不需要 superpowers skills 的場景
- 臨時 workspace

---

## 推薦配置

### 配置 1: 單用戶環境（當前預設）

```json
{
  "plugins": {
    "claw-core": {
      "defaultWorkspace": "~/Documents/claw_core",
      "workspaceStrategy": "shared"
    }
  }
}
```

**Skills 處理**: 使用 `init-workspace.cjs` 安裝一次到 `~/Documents/claw_core/shared_skills/`

---

### 配置 2: 多用戶環境（Symlink 策略）- 推薦

```json
{
  "plugins": {
    "claw-core": {
      "workspaceStrategy": "per-session",
      "workspaceBase": "~/.openclaw/workspaces",
      "skillsStrategy": "symlink",          // 新選項
      "globalSkillsDir": "~/.openclaw/shared_skills"  // 新選項
    }
  }
}
```

**Skills 處理**:
1. 運行一次: `openclaw clawcore init-workspace --workspace ~/.openclaw/shared_skills`
2. 每個新 session workspace 自動 symlink 到主 skills 目錄

---

### 配置 3: 企業多用戶（Copy 策略）

```json
{
  "plugins": {
    "claw-core": {
      "workspaceStrategy": "per-account",
      "skillsStrategy": "copy",
      "globalSkillsDir": "~/.openclaw/shared_skills"
    }
  }
}
```

**Skills 處理**: 每個用戶 workspace 獲得完整的 skills 副本

---

## 實作指南

### 方式 A: 使用更新後的範例代碼

```javascript
import { SessionWorkspaceManager } from './examples/workspace-isolation-example.js';

const manager = new SessionWorkspaceManager();

// 使用 symlink 策略（預設）
const ws = await manager.getWorkspace('session-123');
// shared_skills/ 會自動 symlink 到 ~/.openclaw/shared_skills

// 使用 copy 策略
const manager2 = new SessionWorkspaceManager(null, { skillsStrategy: 'copy' });
const ws2 = await manager2.getWorkspace('session-456');
// shared_skills/ 會被完整複製
```

### 方式 B: 手動設置（Bash）

```bash
# 1. 創建主 skills 目錄
mkdir -p ~/.openclaw/shared_skills
openclaw clawcore init-workspace --workspace ~/.openclaw/shared_skills

# 2. 創建 session workspace 並 symlink
SESSION_ID="abc123"
WORKSPACE=~/.openclaw/workspaces/session-$SESSION_ID

mkdir -p $WORKSPACE/{shared_memory,projects,generated/images}
ln -s ~/.openclaw/shared_skills $WORKSPACE/shared_skills

echo "✓ Created workspace with symlinked skills"
```

### 方式 C: 更新 init-workspace.cjs（未來）

在 `init-workspace.cjs` 中添加 `--skills-strategy` 選項：

```bash
# Symlink 策略
node init-workspace.cjs init --workspace /path --skills-strategy symlink

# Copy 策略
node init-workspace.cjs init --workspace /path --skills-strategy copy

# 空目錄
node init-workspace.cjs init --workspace /path --skills-strategy none
```

---

## Skills 更新流程

### Symlink 策略更新

```bash
# 更新主 skills 目錄
cd ~/.openclaw/shared_skills
git clone --depth 1 https://github.com/obra/superpowers.git tmp
cp -r tmp/skills/* .
rm -rf tmp

# ✓ 所有 workspace 立即使用新版本（因為是 symlink）
```

### Copy 策略更新

```bash
# 需要更新每個 workspace
for workspace in ~/.openclaw/workspaces/*/; do
  echo "Updating $workspace"
  rm -rf "$workspace/shared_skills"
  cp -r ~/.openclaw/shared_skills "$workspace/"
done
```

---

## 最佳實踐

### 1. 初始設置

```bash
# 第一次設置：創建並初始化主 skills 目錄
mkdir -p ~/.openclaw/shared_skills
openclaw clawcore init-workspace --workspace ~/.openclaw/shared_skills

# 驗證 skills 已安裝
ls ~/.openclaw/shared_skills/
# 應該看到: brainstorming/ test-driven-development/ 等
```

### 2. 創建 Session Workspace

```javascript
// 使用 SessionWorkspaceManager
const manager = new SessionWorkspaceManager();
const workspace = await manager.getWorkspace(sessionId);
// shared_skills 會自動處理
```

### 3. 驗證 Skills 可用

```bash
# 檢查 symlink
ls -l ~/.openclaw/workspaces/session-abc/shared_skills
# 應該顯示: shared_skills -> /Users/xxx/.openclaw/shared_skills

# 驗證 skills 可訪問
ls ~/.openclaw/workspaces/session-abc/shared_skills/
# 應該顯示所有 skills
```

### 4. 監控磁碟使用

```bash
# Symlink 策略
du -sh ~/.openclaw/shared_skills
# 約 10-20 MB

# Copy 策略（100 個 sessions）
du -sh ~/.openclaw/workspaces/
# 可能 1-2 GB

# 對比清晰！
```

---

## 故障排除

### 問題 1: Symlink 不工作

**症狀**: Skills 不可見

```bash
# 檢查 symlink 是否有效
ls -l workspace/shared_skills

# 如果損壞，重新創建
rm workspace/shared_skills
ln -s ~/.openclaw/shared_skills workspace/shared_skills
```

### 問題 2: Skills 版本不一致

**Symlink 策略**: 所有 workspace 自動同步，不會發生

**Copy 策略**: 需要手動更新每個 workspace

### 問題 3: 權限問題

```bash
# 確保主 skills 目錄可讀
chmod -R 755 ~/.openclaw/shared_skills
```

---

## 總結建議

| 使用場景 | 推薦策略 | 理由 |
|---------|---------|------|
| 單用戶 | 直接使用 defaultWorkspace | 不需要隔離 |
| 多用戶 SaaS | **Symlink** ✨ | 節省空間，統一管理 |
| 企業客製化 | Copy | 每個客戶獨立配置 |
| 測試環境 | None | 最小化，快速 |
| Telegram bots (< 5) | Copy | Bot 數量少，可以獨立 |
| Telegram bots (> 10) | **Symlink** ✨ | 太多 bot，共享 skills |

**預設推薦**: Symlink 策略 - 平衡了空間效率、維護性和一致性。

---

## 下一步

1. ✅ 更新 `examples/workspace-isolation-example.js` 支援 skills 策略
2. 📝 在 `init-workspace.cjs` 中添加 `--skills-strategy` 選項（未來）
3. 🔧 在 `plugin/index.ts` 的 `resolveWorkspace()` 中集成 skills 策略（未來）
4. 📚 更新 `WORKSPACE_USAGE.md` 包含 skills 管理說明

需要我實作任何特定策略嗎？
