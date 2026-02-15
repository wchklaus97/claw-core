# OpenClaw Claw Core 外掛（繁體中文）

[English](README.md) | [简体中文](README-zh-Hans.md) | 繁體中文

OpenClaw 的 **Claw Core** 終端執行層外掛。安裝後，claw_core 會隨 OpenClaw 自動啟動，代理可使用其進行工作階段管理的命令執行。

**相容性：** 參見 [相容性](#相容性) 了解 OpenClaw 與 Cursor CLI 版本需求。

## 安裝

```bash
openclaw plugins install @wchklaus97hk/claw-core
```

或從本機路徑安裝（如開發時）：

```bash
openclaw plugins install ./plugin
```

安裝後重啟 OpenClaw gateway。

### 一鍵安裝（binary 自動下載）

OpenClaw 安裝外掛時只解壓 npm 套件，不執行 `npm install`，因此 postinstall 不會執行。**daemon 腳本**（`claw_core_daemon.sh`）會補足：首次執行 `openclaw clawcore start`（或 boot hook）時，若外掛 binary 不存在，會從 GitHub Releases 自動下載、設定 `openclaw.json` 並安裝 skills。無需手動設定 binary。

## 相容性

| 依賴 | 測試版本 |
|------|----------|
| **OpenClaw** | 2026.2.13（使用 `openclaw update` 取得最新版） |
| **Cursor CLI** | Cursor IDE 2.5.11 — 包含 `agent` 與 `cursor agent` |

Cursor 整合優先使用 PATH 中的 `agent`，否則使用 `cursor agent`。兩者在非互動模式下均需 `--output-format stream-json`。

## 前置需求

**平台：** 僅支援 Linux 與 macOS。不支援 Windows（claw_core 使用 Unix 域 socket 與 Unix 專用 API）。

1. **claw_core binary** — 任選其一：
   - **自動下載**（推薦）：執行 `openclaw clawcore start`；daemon 腳本首次執行時會從 GitHub Releases 下載
   - **手動下載預編譯**（無需 Rust）：[GitHub Releases](https://github.com/wchklaus97/claw-core/releases) — 解壓並加入 PATH 或設定 `binaryPath`
   - `cargo install claw_core`（需要 Rust，若在 crates.io）
   - 從原始碼建置：`cd /path/to/claw && cargo build --release` — 然後在外掛設定中設定 `sourcePath`
   - 在外掛設定中設定 `binaryPath` 指向預編譯 binary

2. **Python 3** — 供 `claw_core_exec.py` 使用（exec 封裝）

## 設定

在 `~/.openclaw/openclaw.json` 的 `plugins.entries.claw-core` 下新增：

```json
{
  "plugins": {
    "entries": {
      "claw-core": {
        "enabled": true,
        "config": {
          "socketPath": "/tmp/trl.sock",
          "binaryPath": "/path/to/claw_core",
          "sourcePath": "/path/to/claw",
          "autoStart": true
        }
      }
    }
  }
}
```

- **binaryPath** — claw_core binary 路徑（可選；預設使用 PATH 或 ~/.cargo/bin）
- **socketPath** — Unix socket 路徑（預設 `/tmp/trl.sock`）
- **sourcePath** — 用於從原始碼建置的 claw 倉庫路徑（可選）
- **autoStart** — gateway 啟動時啟動 claw_core（預設 true）

## 外掛提供功能

1. **Boot hook** — 當 `autoStart` 為 true 時，在 `gateway:startup` 時啟動 claw_core
2. **Skills** — 安裝時將所有 skills 複製到 `~/.openclaw/skills/`：
   - claw-core-runtime、claw-core-sessions、claw-core-daemon
   - claw-core-install、claw-core-remove（完整安裝/移除流程）
   - cron-helper、cursor-agent、cursor-cron-bridge、plans-mode、status-dashboard、cursor-setup
3. **CLI** — `openclaw clawcore start|stop|restart|status|setup-cursor|teardown`
4. **Gateway RPC** — `clawcore.status`
5. **Cursor CLI 整合** — 自動設定 `openclaw.json` 中的 cliBackends、cursor-dev agent 及 subagents 允許清單
6. **腳本**（包含在外掛中，供 skills 使用）：
   - `scripts/claw_core_daemon.sh` — 啟動/停止/重啟/狀態；首次啟動時若缺失會自動下載 binary（OpenClaw 不執行 postinstall）
   - `scripts/claw_core_exec.py` — 單次 exec 封裝
   - `scripts/cron_helper.py` — 簡單 cron 任務建立
   - `scripts/status_dashboard.py` — 顯示 sessions、cron 任務、活動
   - `scripts/install-skills-to-openclaw.sh` — 將 skills 複製到 `~/.openclaw/skills/`（postinstall 時執行）
   - `scripts/setup-cursor-integration.js` — 在 openclaw.json 中設定 Cursor CLI 整合
   - `scripts/teardown-openclaw-config.js` — 清理 openclaw.json 和 skills（用於移除/卸載）

Skills 引用 `$PLUGIN_ROOT` 作為腳本路徑（外掛安裝目錄，例如 `~/.openclaw/extensions/claw-core`）。

向 agent 說：「Install claw core」或「Remove claw core」— claw-core-install 與 claw-core-remove skills 會執行完整步驟。

## Cursor CLI 整合

外掛可設定 OpenClaw 將任務委派給 Cursor CLI：

```bash
# 設定 Cursor 整合（新增 cliBackends、cursor-dev agent、allowAgents）
openclaw clawcore setup-cursor

# 指定自訂 workspace
openclaw clawcore setup-cursor --workspace /path/to/project

# 重啟 gateway 使設定生效
openclaw gateway restart
```

首次執行 `openclaw clawcore start`（下載 binary 時）也會自動執行。

或在聊天中對 agent 說：「Set up Cursor integration」。

## 疑難排解

- `agentId is not allowed for sessions_spawn`：執行 `openclaw clawcore setup-cursor`，然後 `openclaw gateway restart`
- 找不到 `agent` / `cursor`：安裝 Cursor CLI 並確認 `agent` 或 `cursor` 在 PATH 中
- 設定檔驗證錯誤：執行 `openclaw doctor --fix`，再執行 `openclaw clawcore setup-cursor`

## 手動控制

```bash
openclaw clawcore status
openclaw clawcore start
openclaw clawcore stop
openclaw clawcore teardown   # 停止並清理設定；然後：rm -rf ~/.openclaw/extensions/claw-core
```

## 開發

在 claw 倉庫中：

```bash
openclaw plugins install -l ./plugin
```

這會連結外掛（不複製），修改即時生效。變更後重啟 gateway。
