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

## 外掛功能與說明（v0.0.7）

claw-core 外掛提供以下能力。

### CLI 命令

| 命令 | 用途 |
|------|------|
| `openclaw clawcore start \| stop \| restart \| status` | 守護進程生命週期 |
| `openclaw clawcore setup-cursor` | 設定 Cursor CLI 並建立工作區 |
| `openclaw clawcore init-workspace` | 建立含 shared_memory、shared_skills、generated/ 的工作區 |
| `openclaw clawcore reset-workspace` | 重置工作區（會備份 shared_memory） |
| `openclaw clawcore setup-bots` | 一鍵設定 3 個 Telegram 機器人（artist、assistant、developer） |
| `openclaw clawcore team` | 代理團隊：建立、setup-telegram、列表 |
| `openclaw clawcore teardown` | 停止守護進程並清理 |
| `openclaw picoclaw status \| config \| chat "<訊息>"` | PicoClaw（選用） |

### 代理工具

| 工具 | 用途 |
|------|------|
| `cursor_agent_direct` | 呼叫 Cursor Agent 進行編程與複雜任務；輸出寫入工作區（Cursor CLI 不支援圖片生成）。支援模式：**agent**（執行）、**plan**（先規劃後執行）、**ask**（唯讀）。測試說明見 [CURSOR_CLI_MODES_TESTING.md](../plugin/docs/CURSOR_CLI_MODES_TESTING.md)。 |
| `picoclaw_chat` | 向 PicoClaw 發送訊息，用於快速問答與網頁搜尋（選用；尚未測試） |
| `picoclaw_config` | 檢視或設定 PicoClaw 設定（選用；尚未測試） |
| `team_coordinate` | 管理團隊任務板與協作 |

### 工作區與多機器人

- **預設工作區：** `~/Documents/claw_core`（或透過 `defaultWorkspace` 與 `--workspace` 自訂）。
- **工作區結構：** `shared_memory/`、`shared_skills/`、`projects/`、`generated/exports/`。
- **按代理工作區：** Telegram 機器人使用 `~/.openclaw/workspace-{bot_id}/`；工作區可按代理解析或顯式傳給工具。

### 代理團隊

- 多代理協作與共享任務板。
- 透過 `openclaw clawcore team setup-telegram` 設定 Telegram 群組。
- 工具與技能：`team_coordinate`，team-lead、team-member、team-telegram-group。

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
2. **動作：** 依序執行 `postinstall-download-binary.sh`（從 GitHub Releases 下載 binary）、`postinstall-config-openclaw.cjs`（在 `openclaw.json` 中設定 `binaryPath`）、`install-skills-to-openclaw.sh`（將 skills 複製到 `~/.openclaw/skills/`）、`setup-cursor-integration.cjs`（在 `openclaw.json` 中設定 Cursor 整合）。
3. **之後：** 呼叫 `find_binary()` 並啟動 daemon。

這樣可實現一步安裝：`openclaw plugins install @wchklaus97hk/claw-core` 後再執行 `openclaw clawcore start`，即可完成安裝，無需額外手動操作。

### OpenClaw Skills

外掛包含 12+ 個 skills（規範列表：`scripts/claw-core-skills.list`）：

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
| **claw-core-workspace** | 如何在 claw_core 工作區內工作（閱讀 WORKSPACE.md，使用 shared_memory、shared_skills） |

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

**為何需要：** OpenClaw 安裝外掛時只解壓 npm 套件，不執行 `npm install`，因此 postinstall 不會執行。daemon 腳本會在首次啟動時執行 `setup-cursor-integration.cjs` 補齊設定。若自動設定被略過或需重新設定，請使用下方手動步驟。

### 分步設定

1. **安裝外掛：** `openclaw plugins install @wchklaus97hk/claw-core`
2. **啟動 daemon（自動設定）：** `openclaw clawcore start` — 首次執行會下載 binary 並在 `openclaw.json` 中設定 Cursor
3. **可選手動設定：** 若 Cursor 整合缺失或需指定其他 workspace：`openclaw clawcore setup-cursor`（或 `--workspace /path/to/project`）
4. **重啟 gateway：** `openclaw gateway restart`

### 工作區結構

執行 `openclaw clawcore setup-cursor` 時，會建立並設定 Cursor 代理的工作目錄（**工作區**）。預設路徑為 `~/Documents/claw_core`。

| 路徑 | 用途 |
|------|------|
| `shared_memory/` | 每日日誌（`YYYY-MM-DD.md`）、長期筆記、主題檔 — 跨工作階段持久化上下文 |
| `shared_skills/` | 所有代理可用的技能（superpowers 工作流程、claw-core-workspace、model-selection-agent 等） |
| `projects/` | 外部倉庫的符號連結或克隆 — 在 `projects/repo-name/` 內工作，保持在工作區內 |
| `generated/exports/` | 產生產物 |

`setup-cursor` 會呼叫 `init-workspace.cjs`，後者會複製 `WORKSPACE.md` 與 `.gitignore`，並從 `default-skills.json` 安裝預設技能到 `shared_skills/`。進階使用者可執行 `node $PLUGIN_ROOT/scripts/init-workspace.cjs init`（或 `reset`）來重新初始化或重置工作區。

### 依賴

- **Cursor CLI** 在 PATH 中（`agent` 或 `cursor` — 有 `agent` 時優先使用）
- **Cursor 登入：** 執行 `agent login` 或 `cursor agent login` 或設定 `CURSOR_API_KEY`

### 自動設定（首次啟動）

`openclaw clawcore start` 首次執行下載 binary 時，會自動執行 `setup-cursor-integration.cjs`。

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
      "workspace": "~/Documents/claw_core",
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

## PicoClaw（選用，尚未測試）

外掛（v0.0.7）可整合 [PicoClaw](https://github.com/sipeed/picoclaw)，用於快速問答與網頁搜尋。

- **工具：** `picoclaw_chat`（發送訊息）、`picoclaw_config`（檢視/設定模型、提供者、語言）
- **CLI：** `openclaw picoclaw status | config | chat "<訊息>"`
- **設定：** 若已安裝 PicoClaw，可於外掛設定中設定 `picoClawPath` 與 `enablePicoClaw: true`。

**說明：** PicoClaw 整合**尚未經過測試**，僅作為選用功能提供。如需嘗試，請從 https://github.com/sipeed/picoclaw 安裝 PicoClaw。

## ZeroClaw 支援（實驗性，尚未測試）

[ZeroClaw](https://github.com/ArcadeLabsInc/zeroclaw) 是一個獨立的全 Rust AI 代理執行環境，專注於效能、最小二進位大小與安全性。與 OpenClaw（Node.js/npm）不同，ZeroClaw 不使用 npm 外掛系統，因此 OpenClaw 外掛無法直接在其中執行。

然而，`claw_core` 守護程序協定（Unix socket 上的 JSON）與**執行環境無關**。我們提供了一個獨立的 Rust crate — [`claw-core-protocol`](https://crates.io/crates/claw-core-protocol) — 為 ZeroClaw（或任何 Rust 程式）提供型別化的非同步客戶端來連線守護程序。

### 運作原理

1. **安裝 crate：** 該 crate 已發佈到 crates.io，也可作為路徑依賴從 `crates/claw-core-protocol/` 取得。
2. **功能旗標：** ZeroClaw 透過 `cargo install zeroclaw --features claw-core` 進行整合。
3. **執行時：** 當 `claw-core` 功能啟用且 ZeroClaw 設定中 `claw_core.enabled = true` 時，會註冊一個 `ClawCoreExecTool`。它連線到同一個守護程序 socket，建立工作階段並執行命令 — 與 OpenClaw 外掛的方式相同。

### 架構

```
ZeroClaw（Rust 二進位）
  └─ claw-core 功能旗標
       └─ claw-core-protocol crate
            └─ Unix socket ─── claw_core 守護程序
```

### 狀態

> **此整合尚未經過測試。** `claw-core-protocol` crate 可以編譯，架構已就緒，但尚未在 ZeroClaw + claw_core 守護程序的完整環境中進行端對端測試。使用風險自負，如有問題請在 GitHub 上回報。

詳情請參閱 [`crates/claw-core-protocol/README.md`](https://github.com/wchklaus97/claw-core/tree/main/crates/claw-core-protocol)。

## 快速參考

- **一步安裝：** `openclaw plugins install @wchklaus97hk/claw-core`，然後 `openclaw clawcore start`
- **本機安裝：** `./scripts/install-claw-core-openclaw.sh`（用 `--force` 重裝）
- **卸載：** `./scripts/remove-claw-core-openclaw.sh`
- **驗證：** `./scripts/verify_integration.sh`
- **啟動 Runtime：** `openclaw clawcore start` 或 daemon 腳本
- **檢視狀態：** `openclaw clawcore status`
- **設定 Cursor：** `openclaw clawcore setup-cursor`
- **RPC：** 從 gateway 呼叫 `clawcore.status`
