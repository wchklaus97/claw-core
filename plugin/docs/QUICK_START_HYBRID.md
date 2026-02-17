# 快速開始：混合 Workspace 策略

## 5 分鐘設置指南

### 第 1 步：創建主 Skills 目錄

```bash
# 創建並初始化共享 skills 目錄（只需一次）
mkdir -p ~/.openclaw/shared_skills
openclaw clawcore init-workspace --workspace ~/.openclaw/shared_skills

# 驗證 skills 已安裝
ls ~/.openclaw/shared_skills/
# 應該看到: brainstorming/ test-driven-development/ systematic-debugging/ 等
```

### 第 2 步：使用混合管理器

```javascript
// app.js
import { HybridWorkspaceManager } from './plugin/examples/hybrid-workspace-manager.js';

const manager = new HybridWorkspaceManager();

// 90% 的用戶 - 自動使用 symlink（0 MB）
async function handleStandardUser(userId) {
  const workspace = await manager.getWorkspace(userId, {
    tier: 'free'  // 或 'standard'
  });
  
  return workspace.workspace;  // 用於 cursor_agent_direct
}

// 10% 的 VIP 用戶 - 自動使用獨立副本（15 MB）
async function handlePremiumUser(userId) {
  const workspace = await manager.getWorkspace(userId, {
    tier: 'premium'  // 或 'enterprise'
  });
  
  return workspace.workspace;
}

// 動態升級 - 用戶要求客製化
async function enableCustomization(userId) {
  await manager.breakSymlink(userId);
  
  // 現在可以添加客製化 skill
  await manager.addCustomSkill(userId, 'my-custom-skill', `
---
name: my-custom-skill
---
# My Custom Skill
...
  `);
}
```

### 第 3 步：集成到你的 API

```javascript
// api.js
app.post('/api/cursor/generate', async (req, res) => {
  const { userId, prompt } = req.body;
  
  // 獲取用戶的 workspace（自動處理 skills）
  const userProfile = await getUserProfile(userId);
  const session = await manager.getWorkspace(userId, userProfile);
  
  // 調用 cursor_agent_direct
  const result = await openclaw.callTool('cursor_agent_direct', {
    prompt: prompt,
    workspace: session.workspace  // 明確傳遞
  });
  
  res.json(result);
});
```

### 第 4 步：監控和維護

```javascript
// 每日報告
async function dailyReport() {
  const report = await manager.generateDiskReport();
  
  console.log(`
📊 Daily Workspace Report
─────────────────────────────────────
Total Sessions:     ${report.totalSessions}
Symlinked (0 MB):   ${report.symlinked}
Copied (${report.diskUsed} MB):    ${report.copied}
Disk Saved:         ${report.diskSaved} MB
Efficiency:         ${report.efficiency}
  `);
}

// 每週清理
async function weeklyCleanup() {
  const deleted = await manager.cleanup(7);  // 刪除 7 天未使用的
  console.log(`Cleaned up ${deleted} old sessions`);
}
```

## 完整範例（複製即用）

```javascript
#!/usr/bin/env node
/**
 * Complete hybrid workspace example
 * Save as: server.js
 * Run: node server.js
 */

import express from 'express';
import { HybridWorkspaceManager } from './plugin/examples/hybrid-workspace-manager.js';

const app = express();
const manager = new HybridWorkspaceManager();

app.use(express.json());

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

// Generate image via Cursor
app.post('/api/generate-image', async (req, res) => {
  try {
    const { userId, prompt, tier = 'free' } = req.body;
    
    // Get workspace (auto-handles skills)
    const session = await manager.getWorkspace(userId, { tier });
    
    // Call cursor_agent_direct
    const result = await openclaw.callTool('cursor_agent_direct', {
      prompt: `Generate an image: ${prompt}`,
      workspace: session.workspace
    });
    
    res.json({
      success: true,
      output: result.output,
      files: result.files_created,
      workspace: session.workspace,
      skillsStrategy: session.skillsStrategy
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Upgrade user (break symlink for customization)
app.post('/api/upgrade/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    
    await manager.breakSymlink(userId);
    
    res.json({
      success: true,
      message: `User ${userId} upgraded to independent skills`
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Add custom skill
app.post('/api/custom-skill/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const { skillName, content } = req.body;
    
    await manager.addCustomSkill(userId, skillName, content);
    
    res.json({
      success: true,
      message: `Added custom skill '${skillName}' to user ${userId}`
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Disk usage report
app.get('/api/report', async (req, res) => {
  const report = await manager.generateDiskReport();
  res.json(report);
});

// List all sessions
app.get('/api/sessions', (req, res) => {
  const sessions = manager.listSessions();
  res.json(sessions);
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`📊 Using hybrid workspace strategy`);
});
```

## 測試命令

```bash
# 1. 創建標準用戶（symlink）
curl -X POST http://localhost:3000/api/generate-image \
  -H "Content-Type: application/json" \
  -d '{"userId":"alice","prompt":"cat","tier":"free"}'

# 2. 創建 VIP 用戶（copy）
curl -X POST http://localhost:3000/api/generate-image \
  -H "Content-Type: application/json" \
  -d '{"userId":"vip1","prompt":"dog","tier":"premium"}'

# 3. 升級用戶（break symlink）
curl -X POST http://localhost:3000/api/upgrade/alice

# 4. 查看報告
curl http://localhost:3000/api/report

# 5. 列出所有 sessions
curl http://localhost:3000/api/sessions
```

## 預期結果

```json
{
  "totalSessions": 10,
  "symlinked": 8,           // 80% 用戶
  "copied": 2,              // 20% VIP 用戶
  "diskUsed": 30,           // MB
  "diskSaved": 120,         // MB
  "efficiency": "80.0%"     // 節省 80% 空間
}
```

## 常見問題

### Q: 如何知道用戶是否需要獨立 skills？

A: 根據用戶 tier 或需求：

```javascript
const needsCopy = 
  userProfile.tier === 'premium' || 
  userProfile.tier === 'enterprise' ||
  userProfile.customSkills === true;
```

### Q: 打斷 symlink 後還能恢復嗎？

A: 可以，但會丟失客製化：

```javascript
await manager.restoreSymlink(userId, { force: true });
```

### Q: 磁碟空間不足怎麼辦？

A: 定期清理舊 sessions 和檢查未使用的獨立副本：

```javascript
// 清理 7 天未使用的
await manager.cleanup(7);

// 或手動刪除
rm -rf ~/.openclaw/workspaces/session-old-123
```

## 下一步

- 📖 閱讀完整文檔: `docs/HYBRID_SKILLS_STRATEGY.md`
- 🧪 運行範例: `node examples/hybrid-workspace-manager.js`
- 🔧 根據需求調整配置

**混合策略 = 效率 + 靈活性** 🎯
