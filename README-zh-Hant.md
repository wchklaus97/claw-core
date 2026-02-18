# Claw Core（繁體中文）

[![Rust](https://img.shields.io/badge/Rust-stable-orange?logo=rust)](https://www.rust-lang.org/)
![Version](https://img.shields.io/badge/version-0.1.0-blue)
[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)

![Claw Core 橫幅](assets/images/claw-core-hero-banner.jpeg)

Agent CLI 執行運行時：穩定、可控、可觀測的命令執行核心。

完全支援 OpenClaw，並提供用於 OpenClaw 工作流程的 Cursor 外掛整合（`plugin/`）。測試版本：OpenClaw 2026.2.13、Cursor IDE 2.5.11，詳見 [外掛說明](plugin/README-zh-Hant.md#相容性)。

> **CLI 整合狀態：** Cursor CLI 與 Codex CLI 整合已可用但尚未完全整合；Kilo Code 尚未執行或測試。詳見 [外掛 README](plugin/README-zh-Hant.md)。
>
> 外掛以本機子進程方式封裝 Cursor CLI，符合 Cursor 服務條款（§1.5、§6）。ToS 截圖（最後更新 2026-01-13）：[`assets/images/cursor-tos-screenshot.png`](assets/images/cursor-tos-screenshot.png)

---

## What（是什麼）

Claw Core 是 AI 代理與作業系統進程之間的 Rust 運行時層。  
代理透過 JSON 協定呼叫 Claw Core，而不是直接 `exec`。

```text
Agent / Gateway  -->  Claw Core (JSON API)  -->  OS processes
```

---

## Why（為什麼）

讓代理直接執行系統命令，在實務上常見不穩定、不可控、難除錯。  
Claw Core 以一致的執行模型處理這些風險。

---

## 解決的問題

| 問題 | Claw Core 的解法 |
|---|---|
| 失控進程 | 命令/會話逾時與自動清理 |
| 會話混亂 | 明確生命週期與隔離邊界 |
| 回應不一致 | 標準化 JSON 回傳 |
| 可觀測性不足 | 運行時統計與健康檢查介面 |
| 密鑰風險 | 環境變數透傳，不落碟 |
| OpenClaw 串接複雜 | 透過 Cursor 外掛直接接入 OpenClaw 真實工作流程 |

---

## How（如何運作）

| 步驟 | 說明 |
|---|---|
| 1 | 代理送出 JSON 請求（`system.ping`、`session.*`、`exec.run`、`system.stats`） |
| 2 | Claw Core 驗證並分派至對應模組 |
| 3 | 執行器依逾時策略執行並收集輸出 |
| 4 | 回傳結構化結果給呼叫方 |

---

## 快速開始

### 前置需求

| 需求 | 說明 |
|---|---|
| Rust stable | `rustup toolchain install stable` |
| `socat` | 本機 socket 探測 |

### 啟動

```bash
cargo run -- --socket-path /tmp/trl.sock
```

### 探測

```bash
echo '{"id":"1","method":"system.ping","params":{}}' | socat - UNIX-CONNECT:/tmp/trl.sock
```

### 測試

```bash
cargo test
./scripts/smoke.sh
```

### 推送前檢查

執行 pre-push 腳本驗證核心運行時與 release 構建：

```bash
./scripts/pre-push-test.sh
```

若已安裝 OpenClaw，可加 `--openclaw` 驗證外掛整合：

```bash
./scripts/pre-push-test.sh --openclaw
```

參見 [verify_integration.sh](scripts/verify_integration.sh) 與 [外掛說明](plugin/README-zh-Hant.md) 完成 OpenClaw 配置。一步安裝：`openclaw plugins install @wchklaus97hk/claw-core`，首次執行 `openclaw clawcore start` 時 daemon 會自動下載 binary（OpenClaw 不執行 npm postinstall）。

---

## Build 與 Deploy

### 本機建置

```bash
cargo build --release
```

### 版本發布

| 平台 | 架構 |
|---|---|
| Linux | `x86_64`、`aarch64` |
| macOS | `x86_64`、`aarch64` |
| Windows | 不支援（依賴 Unix domain socket、rlimit 等 Unix 專屬 API） |

發布工作流：`.github/workflows/release.yml` — 推送 `v*` 標籤觸發（例如 `v0.1.0`）。

---

## 版本策略

目前版本：`0.1.0` — 發布以 git tag `v*` 為準。

建議流程：

1. 更新 `Cargo.toml` 版本
2. commit
3. 打並推送 tag：`git tag v0.1.0 && git push origin v0.1.0`
4. 自動產出發布包

---

## 專案結構

```text
claw/
├── src/                   # runtime 實作
├── tests/                 # 單元/整合測試
├── scripts/               # smoke 與輔助腳本
├── plugin/                # 用於 OpenClaw 的 Cursor 外掛整合
├── .github/workflows/     # CI 與發布流程
├── README.md
├── README-zh-Hans.md
└── README-zh-Hant.md
```

---

## 測試

### 1. 外掛安裝與初始化

| # | 測試項 | 命令 | 預期結果 |
|---|--------|------|----------|
| 1.1 | 從 npm 安裝 | `openclaw plugins install @wchklaus97hk/claw-core` | 外掛解壓成功，無報錯 |
| 1.2 | 外掛已載入 | `openclaw clawcore status` | 顯示外掛路徑與狀態 |
| 1.3 | Skills 已安裝 | `ls ~/.openclaw/skills/` | Skills 目錄存在 |
| 1.4 | 解除安裝 | `openclaw plugins uninstall @wchklaus97hk/claw-core` | 清理完整 |

### 2. Daemon 生命週期

| # | 測試項 | 命令 / Telegram | 預期結果 |
|---|--------|----------------|----------|
| 2.1 | 啟動 daemon | `openclaw clawcore start` | PID 檔在 `/tmp/claw_core.pid`，socket 在 `/tmp/trl.sock` |
| 2.2 | 狀態檢查 | `openclaw clawcore status` | 運行中，顯示 PID |
| 2.3 | Ping 探測 | `echo '{"id":"1","method":"system.ping","params":{}}' \| socat - UNIX-CONNECT:/tmp/trl.sock` | 回傳 `"pong"` |
| 2.4 | 重啟 | `openclaw clawcore restart` | 新 PID，socket 存活 |
| 2.5 | 停止 | `openclaw clawcore stop` | PID 檔刪除，socket 消失 |
| 2.6 | 自動啟動（boot hook） | `openclaw gateway restart` | Daemon 自動啟動 |
| 2.7 | **Telegram** | `clawcore status` | Bot 回覆 daemon 狀態 |
| 2.8 | **Telegram** | `start the claw_core daemon` | Bot 啟動 daemon，確認 |

### 3. 工作區初始化

| # | 測試項 | 命令 / Telegram | 預期結果 |
|---|--------|----------------|----------|
| 3.1 | 初始化工作區 | `openclaw clawcore init-workspace` | 建立 `~/Documents/claw_core/`，含 shared_memory、shared_skills、generated/ |
| 3.2 | 驗證目錄結構 | `ls ~/Documents/claw_core/` | 包含 `shared_memory/`、`shared_skills/`、`projects/`、`generated/images/`、`generated/exports/` |
| 3.3 | 設定 Cursor | `openclaw clawcore setup-cursor` | 更新 `openclaw.json`，寫入 cliBackends 與 cursor-dev agent |
| 3.4 | 自訂工作區 | `openclaw clawcore setup-cursor --workspace /tmp/test-ws` | 在指定路徑建立工作區 |
| 3.5 | 重置工作區 | `openclaw clawcore reset-workspace` | 重置工作區，備份 shared_memory |
| 3.6 | **Telegram** | `set up the Cursor integration` | Bot 執行 setup-cursor，確認 |
| 3.7 | **Telegram** | `initialize my workspace` | Bot 建立工作區，列出內容 |

### 4. 命令執行（exec.run）

| # | 測試項 | 命令 / Telegram | 預期結果 |
|---|--------|----------------|----------|
| 4.1 | 簡單命令 | `echo '{"id":"2","method":"exec.run","params":{"session_id":"...","command":"echo hello"}}' \| socat - UNIX-CONNECT:/tmp/trl.sock` | `stdout: "hello\n"`，exit_code 0 |
| 4.2 | 逾時 | exec.run 設 `timeout_s: 2` 執行 `sleep 10` | 回傳逾時錯誤 |
| 4.3 | 環境變數透傳 | exec.run 設 `env: {"FOO":"bar"}` 執行 `echo $FOO` | `stdout: "bar\n"` |
| 4.4 | **Telegram** | `run the command: echo "hello from claw_core"` | Bot 透過 claw_core 執行，回傳輸出 |
| 4.5 | **Telegram** | `run: ls -la ~/Documents/claw_core/` | 回傳工作區列表 |

### 5. 工作階段管理

| # | 測試項 | 命令 / Telegram | 預期結果 |
|---|--------|----------------|----------|
| 5.1 | 建立工作階段 | `session.create` RPC | 回傳 session_id |
| 5.2 | 列出工作階段 | `session.list` RPC | 顯示活躍工作階段 |
| 5.3 | 工作階段詳情 | `session.info` RPC | 回傳工作階段資訊 |
| 5.4 | 刪除工作階段 | `session.destroy` RPC | 工作階段移除 |
| 5.5 | **Telegram** | `list active claw_core sessions` | Bot 回傳工作階段列表 |
| 5.6 | **Telegram** | `clean up all sessions` | Bot 刪除閒置工作階段 |

### 6. Cursor Agent 整合

| # | 測試項 | 命令 / Telegram | 預期結果 |
|---|--------|----------------|----------|
| 6.1 | 直接呼叫 | `cursor_agent_direct` 工具呼叫 | Cursor agent 在工作區執行任務 |
| 6.2 | Plan 模式 | `cursor-plan` backend | Cursor 以 plan 模式回應 |
| 6.3 | Ask 模式 | `cursor-ask` backend | Cursor 以 ask 模式回應 |
| 6.4 | **Telegram** | `ask Cursor to explain what claw_core does` | Bot 呼叫 cursor_agent_direct，回傳解釋 |
| 6.5 | **Telegram** | `use Cursor to write a hello world Python script` | Bot 呼叫 Cursor，工作區生成檔案 |

### 7. Codex Agent 整合

| # | 測試項 | 命令 / Telegram | 預期結果 |
|---|--------|----------------|----------|
| 7.1 | 檢查安裝 | `python3 plugin/scripts/codex_agent_direct.py --check` | 回傳已安裝 + 版本 |
| 7.2 | 直接呼叫 | `codex_agent_direct` 工具呼叫 | Codex 在工作區執行任務 |
| 7.3 | 指定模型 | 工具呼叫設 `model: gpt-4.1` | 使用指定模型 |
| 7.4 | Ask 模式 | 工具呼叫設 `mode: ask` | 唯讀，不寫入檔案 |
| 7.5 | **Telegram** | `use Codex to write a hello world Python script` | Bot 呼叫 codex_agent_direct，工作區生成檔案 |
| 7.6 | **Telegram** | `ask Codex to explain what claw_core does` | Bot 以 ask 模式呼叫 Codex，回傳解釋 |

### 8. Skills 驗證

| # | 測試項 | 命令 / Telegram | 預期結果 |
|---|--------|----------------|----------|
| 8.1 | Skills 已存在 | `ls ~/.openclaw/skills/ \| wc -l` | 20 個 skills |
| 8.2 | 核心運行時 skill | `cat ~/.openclaw/skills/claw-core-runtime/SKILL.md` | Skill 檔案存在 |
| 8.3 | Daemon skill | **Telegram**: `use the claw-core-daemon skill to check status` | Bot 讀取 skill，檢查 daemon |
| 8.4 | Cron helper | **Telegram**: `schedule a reminder in 30 minutes: take a break` | cron-helper 建立任務 |
| 8.5 | 狀態面板 | **Telegram**: `show me the status dashboard` | 回傳系統概覽 |

### 9. Agent 團隊與多 Bot

> **尚未測試。** 需要設定 3 個 Telegram Bot 及群組後再執行此組測試。建議在第 8 節通過後進行。

| # | 測試項 | 命令 / Telegram | 預期結果 |
|---|--------|----------------|----------|
| 9.1 | 設定 Bots | `openclaw clawcore setup-bots` | 3 個 Telegram Bot 設定完成（artist、assistant、developer） |
| 9.2 | 建立團隊 | `openclaw clawcore team create my-team` | 團隊建立成功 |
| 9.3 | 列出團隊 | `openclaw clawcore team list` | 顯示團隊列表 |
| 9.4 | 設定 Telegram 群組 | `openclaw clawcore team setup-telegram` | 群組設定完成 |
| 9.5 | **Telegram（developer bot）** | `write a Rust function that reverses a string` | Developer Bot 委派給 Cursor，回傳程式碼 |
| 9.6 | **Telegram（assistant bot）** | `what's the weather in Hong Kong?` | Assistant Bot 回傳資訊 |
| 9.7 | **Telegram（團隊群組）** | `coordinate: developer writes the code, assistant reviews it` | team_coordinate 分派任務 |

---

## 參考

| 資源 | 連結 |
|---|---|
| 外掛說明 | [plugin/README-zh-Hant.md](plugin/README-zh-Hant.md) |
| Pre-push 測試 | [scripts/pre-push-test.sh](scripts/pre-push-test.sh) |
| 整合驗證 | [scripts/verify_integration.sh](scripts/verify_integration.sh) |
| 安裝 OpenClaw 外掛 | [scripts/install-claw-core-openclaw.sh](scripts/install-claw-core-openclaw.sh) |
| 移除 OpenClaw 外掛 | [scripts/remove-claw-core-openclaw.sh](scripts/remove-claw-core-openclaw.sh) |
| 從發布版安裝 binary | [scripts/install-from-release.sh](scripts/install-from-release.sh) |

---

## 授權

MIT
