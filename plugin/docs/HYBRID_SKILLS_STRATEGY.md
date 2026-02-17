# 混合 Skills 策略（Hybrid Strategy）

## 設計理念

**預設共享，按需獨立** - 平衡磁碟效率與客製化靈活性。

## 核心概念

```
┌─────────────────────────────────────────────────────────────┐
│                    混合策略架構                                │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ~/.openclaw/                                               │
│  ├── shared_skills/          ← 共享主目錄（唯讀參考）         │
│  │   ├── brainstorming/                                    │
│  │   ├── test-driven-development/                          │
│  │   └── ...                                               │
│  │                                                          │
│  └── workspaces/                                           │
│      ├── session-normal-1/                                 │
│      │   └── shared_skills -> ../../shared_skills          │
│      │       (symlink - 99% 的 sessions)                   │
│      │                                                      │
│      ├── session-normal-2/                                 │
│      │   └── shared_skills -> ../../shared_skills          │
│      │       (symlink)                                     │
│      │                                                      │
│      └── session-custom-vip/                               │
│          └── shared_skills/  ← 完整副本（客製化）            │
│              ├── brainstorming/                            │
│              ├── custom-skill-for-vip/  ← 專屬 skill        │
│              └── ...                                       │
│                                                             │
│  磁碟使用: 10 MB (shared) + 10 MB (custom) = 20 MB         │
│  vs. Copy策略: 100 sessions × 10 MB = 1 GB                 │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

## 工作原理

### 自動決策邏輯

```typescript
function determineSkillsStrategy(sessionId, userProfile) {
  // 1. 檢查是否有客製化需求
  if (userProfile.customSkills || userProfile.isPremium) {
    return 'copy';  // 獨立副本
  }
  
  // 2. 檢查是否已存在獨立副本（曾經客製化過）
  if (hasIndependentSkills(sessionId)) {
    return 'copy';  // 維持獨立狀態
  }
  
  // 3. 預設：共享（symlink）
  return 'symlink';
}
```

### "打斷" Symlink 機制

當用戶需要客製化時，可以將 symlink "打斷"為完整副本：

```bash
# 打斷 symlink，轉為獨立副本
openclaw clawcore break-symlink --workspace /path/to/session-xyz
```

```typescript
async function breakSymlink(workspace) {
  const skillsDir = path.join(workspace, 'shared_skills');
  const globalSkills = path.join(os.homedir(), '.openclaw', 'shared_skills');
  
  // 1. 檢查是否是 symlink
  const stats = await fs.lstat(skillsDir);
  if (!stats.isSymbolicLink()) {
    console.log('Already independent, no action needed');
    return;
  }
  
  // 2. 移除 symlink
  await fs.unlink(skillsDir);
  
  // 3. 複製完整副本
  await copyDir(globalSkills, skillsDir);
  
  console.log('✓ Converted to independent skills (can now customize)');
}
```

## 實作範例

### SessionWorkspaceManager 混合版

```javascript
class HybridSessionWorkspaceManager {
  constructor(options = {}) {
    this.baseDir = options.baseDir || path.join(os.homedir(), '.openclaw', 'workspaces');
    this.globalSkills = path.join(os.homedir(), '.openclaw', 'shared_skills');
    this.sessions = new Map();
    this.customSessions = new Set();  // 追蹤需要獨立 skills 的 sessions
  }

  /**
   * 標記某個 session 需要客製化
   */
  markAsCustom(sessionId) {
    this.customSessions.add(sessionId);
  }

  /**
   * 檢查是否需要客製化
   */
  needsCustomSkills(sessionId, userProfile = {}) {
    // 1. 明確標記
    if (this.customSessions.has(sessionId)) return true;
    
    // 2. 用戶特徵
    if (userProfile.customSkills) return true;
    if (userProfile.tier === 'premium' || userProfile.tier === 'enterprise') return true;
    
    // 3. Session 元數據
    if (userProfile.requiresIsolation) return true;
    
    return false;
  }

  /**
   * 創建 workspace（自動決定 skills 策略）
   */
  async getWorkspace(sessionId, userProfile = {}) {
    if (this.sessions.has(sessionId)) {
      return this.sessions.get(sessionId);
    }

    const workspace = path.join(this.baseDir, `session-${sessionId}`);
    
    // 自動決定策略
    const skillsStrategy = this.needsCustomSkills(sessionId, userProfile) 
      ? 'copy' 
      : 'symlink';

    await this.initializeWorkspace(workspace, { skillsStrategy });
    
    const sessionInfo = {
      workspace,
      skillsStrategy,
      createdAt: new Date(),
      lastUsed: new Date(),
    };
    
    this.sessions.set(sessionId, sessionInfo);
    return sessionInfo;
  }

  /**
   * 動態打斷 symlink（轉為獨立副本）
   */
  async breakSymlink(sessionId) {
    const session = this.sessions.get(sessionId);
    if (!session) throw new Error('Session not found');
    
    const skillsDir = path.join(session.workspace, 'shared_skills');
    
    // 檢查是否是 symlink
    const stats = await fs.lstat(skillsDir).catch(() => null);
    if (!stats?.isSymbolicLink()) {
      console.log(`Session ${sessionId} already has independent skills`);
      return false;
    }
    
    console.log(`Converting session ${sessionId} to independent skills...`);
    
    // 移除 symlink
    await fs.unlink(skillsDir);
    
    // 複製完整副本
    await this.copyDir(this.globalSkills, skillsDir);
    
    // 更新狀態
    session.skillsStrategy = 'copy';
    this.markAsCustom(sessionId);
    
    console.log(`✓ Session ${sessionId} now has independent skills`);
    return true;
  }

  /**
   * 添加客製化 skill 到特定 session
   */
  async addCustomSkill(sessionId, skillName, skillContent) {
    // 先確保是獨立副本
    await this.breakSymlink(sessionId);
    
    const session = this.sessions.get(sessionId);
    const skillPath = path.join(session.workspace, 'shared_skills', skillName);
    
    await fs.mkdir(skillPath, { recursive: true });
    await fs.writeFile(
      path.join(skillPath, 'SKILL.md'),
      skillContent
    );
    
    console.log(`✓ Added custom skill '${skillName}' to session ${sessionId}`);
  }
}
```

## 使用場景

### 場景 1: 標準用戶（自動 Symlink）

```javascript
const manager = new HybridSessionWorkspaceManager();

// 普通用戶 - 自動使用 symlink
const workspace1 = await manager.getWorkspace('user-alice-123');
// workspace1.skillsStrategy === 'symlink'
// 磁碟佔用: ~0 MB (只是 symlink)

const workspace2 = await manager.getWorkspace('user-bob-456');
// workspace2.skillsStrategy === 'symlink'
// 磁碟佔用: ~0 MB

// 100 個標準用戶 = ~0 MB (只是 symlinks)
```

### 場景 2: VIP 用戶（自動獨立副本）

```javascript
// VIP 用戶 - 自動使用完整副本
const vipWorkspace = await manager.getWorkspace('vip-user-xyz', {
  tier: 'premium',
  customSkills: true
});
// vipWorkspace.skillsStrategy === 'copy'
// 磁碟佔用: ~10-20 MB

// 添加專屬 skill
await manager.addCustomSkill('vip-user-xyz', 'vip-exclusive-skill', `
# VIP Exclusive Skill
This skill is only for premium users...
`);
```

### 場景 3: 動態升級（打斷 Symlink）

```javascript
// 用戶開始時是標準用戶（symlink）
const workspace = await manager.getWorkspace('user-charlie-789');
// skillsStrategy: 'symlink'

// 用戶升級為 VIP，需要客製化
await manager.breakSymlink('user-charlie-789');
// 現在有獨立副本，可以客製化

// 添加客製化 skill
await manager.addCustomSkill('user-charlie-789', 'charlie-custom-workflow', `
# Charlie's Custom Workflow
...
`);
```

### 場景 4: 企業用戶（預設獨立）

```javascript
// 企業用戶 - 每個都需要獨立配置
const enterpriseUsers = ['acme-dev-1', 'acme-dev-2', 'acme-dev-3'];

for (const userId of enterpriseUsers) {
  const workspace = await manager.getWorkspace(userId, {
    tier: 'enterprise',
    organization: 'acme-corp'
  });
  
  // 每個都是獨立副本
  // 可以為整個組織客製化
}
```

## 配置選項

### openclaw.json 配置

```json
{
  "plugins": {
    "claw-core": {
      "workspaceStrategy": "per-session",
      "skillsStrategy": "hybrid",  // 新的混合策略
      
      "skillsHybrid": {
        "globalSkillsDir": "~/.openclaw/shared_skills",
        "defaultMode": "symlink",
        
        "autoBreakSymlinkRules": [
          {
            "condition": "userTier === 'premium'",
            "action": "copy"
          },
          {
            "condition": "session.requiresCustomSkills",
            "action": "copy"
          }
        ],
        
        "copyForTiers": ["premium", "enterprise"],
        "symlinkForTiers": ["free", "standard"]
      }
    }
  }
}
```

## CLI 命令

### 查看 Skills 狀態

```bash
# 列出所有 workspace 的 skills 狀態
openclaw clawcore skills-status

# 輸出:
# Session              Skills Type    Disk Usage   Custom Skills
# ─────────────────────────────────────────────────────────────
# session-abc123       symlink        0 MB         No
# session-def456       symlink        0 MB         No
# session-vip-789      copy           15 MB        Yes (3)
# session-xyz000       copy           12 MB        Yes (1)
```

### 打斷 Symlink

```bash
# 將 symlink 轉為獨立副本
openclaw clawcore break-symlink --session session-abc123

# 批次打斷
openclaw clawcore break-symlink --tier premium
```

### 重新 Symlink（節省空間）

```bash
# 將獨立副本轉回 symlink（會丟失客製化！）
openclaw clawcore restore-symlink --session session-abc123 --force
```

## 監控與維護

### 磁碟使用報告

```javascript
async function generateDiskReport(manager) {
  const sessions = manager.listSessions();
  
  const symlinked = sessions.filter(s => s.skillsStrategy === 'symlink');
  const copied = sessions.filter(s => s.skillsStrategy === 'copy');
  
  const symlinkDisk = 0;  // Symlinks 不佔空間
  const copiedDisk = copied.length * 15;  // 假設每個 15 MB
  
  console.log(`
Disk Usage Report
─────────────────────────────────────────
Symlinked Sessions:  ${symlinked.length}  (0 MB)
Copied Sessions:     ${copied.length}     (~${copiedDisk} MB)
Total:               ${sessions.length}   (~${copiedDisk} MB)

Savings vs Full Copy: ${(sessions.length * 15) - copiedDisk} MB
  `);
}
```

### 自動清理建議

```javascript
async function suggestOptimizations(manager) {
  const sessions = manager.listSessions();
  
  for (const session of sessions) {
    if (session.skillsStrategy === 'copy') {
      // 檢查是否真的有客製化
      const hasCustomSkills = await checkForCustomSkills(session.workspace);
      
      if (!hasCustomSkills) {
        console.log(`
💡 Suggestion: Session ${session.sessionId} has independent skills
   but no customizations detected. Consider converting to symlink:
   
   openclaw clawcore restore-symlink --session ${session.sessionId}
        `);
      }
    }
  }
}
```

## 遷移指南

### 從 Copy 策略遷移

```bash
# 1. 創建主 skills 目錄
mkdir -p ~/.openclaw/shared_skills
openclaw clawcore init-workspace --workspace ~/.openclaw/shared_skills

# 2. 遷移現有 workspaces
for workspace in ~/.openclaw/workspaces/*/; do
  session_id=$(basename "$workspace")
  
  # 保留需要客製化的
  if has_custom_skills "$workspace"; then
    echo "Keeping independent: $session_id"
  else
    # 轉為 symlink
    rm -rf "$workspace/shared_skills"
    ln -s ~/.openclaw/shared_skills "$workspace/shared_skills"
    echo "Converted to symlink: $session_id"
  fi
done
```

### 從 Symlink 策略遷移

已經是最優狀態，只需要標記需要客製化的 session：

```bash
openclaw clawcore break-symlink --session vip-user-123
```

## 最佳實踐

### 1. 預設 Symlink

90-95% 的用戶使用標準 skills：
```javascript
// 預設行為：symlink
const workspace = await manager.getWorkspace(sessionId);
```

### 2. 按需打斷

只在需要時才創建獨立副本：
```javascript
// 用戶要求客製化時
if (userRequestsCustomization) {
  await manager.breakSymlink(sessionId);
  await manager.addCustomSkill(sessionId, skillName, content);
}
```

### 3. 定期檢查

每月檢查是否有未使用的獨立副本：
```bash
openclaw clawcore skills-audit --suggest-optimizations
```

### 4. 分層定價

```javascript
const tierConfig = {
  free: { skillsStrategy: 'symlink', maxCustomSkills: 0 },
  standard: { skillsStrategy: 'symlink', maxCustomSkills: 0 },
  premium: { skillsStrategy: 'copy', maxCustomSkills: 5 },
  enterprise: { skillsStrategy: 'copy', maxCustomSkills: 'unlimited' }
};
```

## 總結優勢

| 特性 | Pure Symlink | Pure Copy | **Hybrid** ✨ |
|------|-------------|-----------|--------------|
| 磁碟效率 | ⭐⭐⭐⭐⭐ | ⭐ | ⭐⭐⭐⭐ |
| 客製化靈活性 | ⭐ | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ |
| 更新簡便性 | ⭐⭐⭐⭐⭐ | ⭐ | ⭐⭐⭐⭐ |
| 複雜度 | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ | ⭐⭐⭐ |
| 適合規模 | 無限 | < 20 | 無限 |

**混合策略 = 兩全其美** 🎯

- 標準用戶享受 symlink 的效率
- VIP 用戶獲得完整客製化能力
- 系統可以根據需求動態調整
- 磁碟使用量最優化
