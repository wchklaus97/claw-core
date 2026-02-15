# OpenClaw 整合

說明 `claw_core` 如何與 OpenClaw 整合，實現自動啟動與受管命令執行。

**文件：** [https://wchklaus97.github.io/claw-core/zh-Hant/book/](https://wchklaus97.github.io/claw-core/zh-Hant/book/)

**路徑佔位符：** `$CLAW_ROOT` = claw 倉庫，`$WORKSPACE` = OpenClaw 工作區，`$PLUGIN_ROOT` = 外掛安裝目錄。

## 概覽

**claw_core** 是 Rust 實現的終端 Runtime 層，**OpenClaw** 是 AI 代理框架。該整合使 OpenClaw 能夠：

1. 閘道啟動時自動啟動 **claw_core**（透過 boot hook）
2. 在可用時優先使用 **claw_core** 執行命令
3. 透過 skills 管理 **claw_core** 生命週期
4. 當 **claw_core** 不可用時平滑降級到普通 `exec`

## 架構

```
┌────────────────────────────────────────┐
│  OpenClaw Gateway (Node.js)            │
└────────────┬───────────────────────────┘
             │ 1. gateway:startup event
             ↓
┌────────────────────────────────────────┐
│  Boot hook (boot-claw-core)            │
│  - Runs on gateway startup             │
│  - Starts claw_core daemon             │
└────────────┬───────────────────────────┘
             │ 2. start daemon
             ↓
┌────────────────────────────────────────┐
│  claw_core (Rust daemon)               │
│  - Listens on /tmp/trl.sock            │
│  - Manages terminal sessions           │
└────────────┬───────────────────────────┘
             │ 3. exec commands via socket
             ↓
┌────────────────────────────────────────┐
│  OpenClaw Skills                       │
│  - claw-core-runtime (exec wrapper)    │
│  - claw-core-sessions (list/manage)    │
│  - claw-core-daemon (start/stop)       │
└────────────────────────────────────────┘
```

## 組件

### Boot Hook

**位置：** 外掛 hook `boot-claw-core`（或 `$WORKSPACE/BOOT.md`）

在 `gateway:startup` 事件觸發時呼叫，並透過 daemon 腳本啟動 claw_core。

### Daemon 管理腳本

**位置：** `$PLUGIN_ROOT/scripts/claw_core_daemon.sh` 或 `$CLAW_ROOT/scripts/claw_core_daemon.sh`

```bash
./claw_core_daemon.sh start   # 啟動
./claw_core_daemon.sh stop    # 停止
./claw_core_daemon.sh restart # 重新啟動
./claw_core_daemon.sh status  # 檢視狀態
```

- PID：`/tmp/claw_core.pid`
- 日誌：`/tmp/claw_core.log`
- Socket：`/tmp/trl.sock`（或 `$CLAW_CORE_SOCKET`）

**自動下載 binary：** OpenClaw 安裝外掛時只解壓 npm 套件，不執行 `npm install`，因此 postinstall 不會執行。daemon 腳本會補齊：首次執行 `start` 時，若外掛 binary 不存在（且未設定 `CLAW_CORE_BINARY` / `CLAW_CORE_SOURCE`），會自動從 GitHub Releases 下載 binary、設定 `openclaw.json` 並安裝 skills。一步安裝：`openclaw plugins install @wchklaus97hk/claw-core`，然後執行 `openclaw clawcore start`。

### 實現：Daemon 自動下載

**問題：** OpenClaw 安裝外掛時只解壓 npm 套件，不在解壓目錄中執行 `npm install`，因此 `postinstall` 腳本（binary 下載、設定、skills）不會執行。

**方案：** daemon 腳本（`claw_core_daemon.sh`）在 `start` 被呼叫且外掛 binary 缺失時，補齊缺失的安裝步驟。在 `start()` 中：

1. **條件：** 未設定 `CLAW_CORE_BINARY` 和 `CLAW_CORE_SOURCE`，且 `$PLUGIN_ROOT/bin/claw_core` 不存在。
2. **動作：** 依序執行 `postinstall-download-binary.sh`（從 GitHub Releases 下載 binary）、`postinstall-config-openclaw.js`（在 `openclaw.json` 中設定 `binaryPath`）、`install-skills-to-openclaw.sh`（將 skills 複製到 `~/.openclaw/skills/`）、`setup-cursor-integration.js`（在 `openclaw.json` 中設定 Cursor 整合）。
3. **之後：** 呼叫 `find_binary()` 並啟動 daemon。

這樣可實現一步安裝：`openclaw plugins install @wchklaus97hk/claw-core` 後再執行 `openclaw clawcore start`，即可完成安裝，無需額外手動操作。

### OpenClaw Skills

外掛包含 11 個 skills（規範列表：`scripts/claw-core-skills.list`）：

| Skill | 用途 |
|-------|---------|
| **claw-core-runtime** | 透過 claw_core 執行命令（封裝 `claw_core_exec.py`） |
| **claw-core-sessions** | 列出並管理 claw_core 會話 |
| **claw-core-daemon** | 從 Agent 側啟動/停止/檢視 daemon |
| **claw-core-install** | 完整安裝或補充安裝（plugins install、daemon start、Cursor 設定） |
| **claw-core-remove** | 完整卸載（停止 daemon、清理設定、移除 skills 與外掛） |
| **cron-helper** | 定時任務排程輔助 |
| **cursor-agent** | Cursor 代理協調 |
| **cursor-cron-bridge** | Cursor 與定時任務的橋接 |
| **plans-mode** | 規劃模式工作流程 |
| **status-dashboard** | 狀態面板監控 |
| **cursor-setup** | 在 `openclaw.json` 中設定 Cursor CLI 整合 |

### 安裝 / 卸載

**一步安裝（npm）：**

```bash
openclaw plugins install @wchklaus97hk/claw-core
openclaw clawcore start   # 首次執行 daemon 自動下載 binary
```

**本機/開發安裝（建置二進位、安裝外掛、自動設定 openclaw.json）：**

```bash
# 安裝
./scripts/install-claw-core-openclaw.sh

# 重新安裝
./scripts/install-claw-core-openclaw.sh --force

# 卸載（同時清理 openclaw.json 中的 Cursor 整合）
./scripts/remove-claw-core-openclaw.sh

# 驗證
./scripts/verify_integration.sh
```

安裝後請重新啟動 OpenClaw gateway。

## Cursor CLI 整合

外掛可以設定 OpenClaw 將任務委派給 Cursor CLI，包括：

- **cliBackends**：`cursor-cli`、`cursor-plan`、`cursor-ask`（Agent、Plan、Ask 模式）
- **cursor-dev agent**：使用 `cursor-cli/auto` 作為模型
- **subagents.allowAgents**：允許主 Agent 將任務派給 cursor-dev

**為何需要：** OpenClaw 安裝外掛時只解壓 npm 套件，不執行 `npm install`，因此 postinstall 不會執行。daemon 腳本會在首次啟動時執行 `setup-cursor-integration.js` 補齊設定。若自動設定被略過或需重新設定，請使用下方手動步驟。

### 分步設定

1. **安裝外掛：** `openclaw plugins install @wchklaus97hk/claw-core`
2. **啟動 daemon（自動設定）：** `openclaw clawcore start` — 首次執行會下載 binary 並在 `openclaw.json` 中設定 Cursor
3. **可選手動設定：** 若 Cursor 整合缺失或需指定其他 workspace：`openclaw clawcore setup-cursor`（或 `--workspace /path/to/project`）
4. **重啟 gateway：** `openclaw gateway restart`

### 依賴

- **Cursor CLI** 在 PATH 中（`agent` 或 `cursor` — 有 `agent` 時優先使用）
- **Cursor 登入：** 執行 `agent login` 或 `cursor agent login` 或設定 `CURSOR_API_KEY`

### 自動設定（首次啟動）

`openclaw clawcore start` 首次執行下載 binary 時，會自動執行 `setup-cursor-integration.js`。

### 手動設定

```bash
# 一行指令：設定 Cursor 並重啟 gateway
openclaw clawcore setup-cursor && openclaw gateway restart

# 使用預設 workspace
openclaw clawcore setup-cursor

# 指定 workspace
openclaw clawcore setup-cursor --workspace /path/to/project

# 重啟 gateway
openclaw gateway restart
```

### 透過 Agent 聊天

告訴 Agent：「設定 Cursor 整合」或「set up Cursor integration」。Agent 會使用 `cursor-setup` skill。

### 會寫入 openclaw.json 的設定

```json
{
  "agents": {
    "defaults": {
      "workspace": "~/.openclaw/workspace",
      "cliBackends": {
        "cursor-cli": {
          "command": "agent",
          "args": ["--print", "--output-format", "stream-json", "--workspace", "..."]
        }
      }
    },
    "list": [
      { "id": "main", "default": true, "subagents": { "allowAgents": ["*"] } },
      { "id": "cursor-dev", "model": { "primary": "cursor-cli/auto" } }
    ]
  }
}
```

### 疑難排解

- **`agentId is not allowed for sessions_spawn`**：執行 `openclaw clawcore setup-cursor`，再執行 `openclaw gateway restart`
- **找不到 `agent` / `cursor` 指令**：安裝 Cursor CLI 並確認 `agent` 或 `cursor` 在 PATH 中
- **設定檔 schema 錯誤**：先執行 `openclaw doctor --fix`，再重新執行 `openclaw clawcore setup-cursor`

## 快速參考

- **一步安裝：** `openclaw plugins install @wchklaus97hk/claw-core`，然後 `openclaw clawcore start`
- **本機安裝：** `./scripts/install-claw-core-openclaw.sh`（用 `--force` 重裝）
- **卸載：** `./scripts/remove-claw-core-openclaw.sh`
- **驗證：** `./scripts/verify_integration.sh`
- **啟動 Runtime：** `openclaw clawcore start` 或 daemon 腳本
- **檢視狀態：** `openclaw clawcore status`
- **設定 Cursor：** `openclaw clawcore setup-cursor`
- **RPC：** 從 gateway 呼叫 `clawcore.status`
