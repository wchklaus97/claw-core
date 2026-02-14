# 架構 — 終端輕量 Runtime 層

這是一個基於 Rust 的執行層，位於 AI 代理（「大腦」）與作業系統之間，負責管理終端會話、執行命令，並透過清晰的 API 回傳輸出。

## 概覽

Terminal Runtime Layer（TRL）解決了一個基礎問題：像 OpenClaw 這樣的 AI 代理當前常常直接在主機上用原始 `exec` 執行命令。這種方式脆弱、不可控，且無法擴展。

TRL 是**執行艙（execution pod）**：它擁有終端會話，在會話中執行命令，擷取輸出，並向代理提供最小 API。

```
┌──────────────────────────────────────────────┐
│  Agent (OpenClaw / any AI orchestrator)       │
│  - Receives user intent (Telegram, CLI, etc)  │
│  - Decides WHAT to run and WHERE              │
└──────────────────┬───────────────────────────┘
                   │  JSON over socket/HTTP
                   │  "run <cmd> in session <id>"
                   ▼
┌──────────────────────────────────────────────┐
│  Terminal Runtime Layer (Rust binary)        │
│  - Manages sessions (id ↔ process group)     │
│  - Spawns processes, captures stdout/stderr  │
│  - Timeout, env vars, lightweight isolation   │
└──────────────────┬───────────────────────────┘
                   │  fork/exec, pipes
                   ▼
┌──────────────────────────────────────────────┐
│  OS (macOS / Linux)                           │
│  - Real processes (shell, python, node, etc)  │
└──────────────────────────────────────────────┘
```

## 成熟度分層

| 層級 | 描述 | 變化點 |
|-------|-------------|--------------|
| **L0** | 主機直接 exec | Agent 直接呼叫 `exec`，無會話管理。 |
| **L1** | 單 Runtime | Agent 與一個 TRL 實例通訊，TRL 管理會話並回傳輸出。 |
| **L2** | 多 Runtime | 多個 TRL 實例（主機、Docker、遠端 SSH），Agent 依任務選擇。 |

**先做 L1。** API 穩定後，L2 可以自然演進。

## 核心組件

### 1. 會話管理器

負責終端會話生命週期。每個會話包含：

- **Session ID**：唯一識別（UUID 或短雜湊）
- **Shell 程序**：底層 shell（bash/zsh）或直接命令
- **工作目錄**：每個會話獨立
- **環境變數**：繼承變數 + 會話層級覆蓋
- **狀態**：`creating`、`idle`、`running`、`terminated`

### 2. 命令執行器

接收執行請求並在會話中執行：

- 用 `std::process::Command` 啟動子程序
- 將 stdout/stderr 回傳給呼叫方
- 支援**同步模式**（等待結束）；串流模式計畫中
- 強制超時（可按命令或會話設定）

### 3. 輸出處理器

- **緩衝模式**：收集全部輸出，在程序結束後回傳（已實作）
- **串流模式**：輸出到達即分塊推送（計畫中）
- 始終包含：stdout、stderr、exit code、duration

### 4. API 服務

- **傳輸**：Unix Socket（已實作）；HTTP 與 stdin/stdout（計畫中）
- **協定**：JSON 請求/回應
- **認證**：HTTP 用 Token；Unix Socket 用檔案權限

### 5. 隔離層（可選）

| 技術 | 成本 | 隔離能力 |
|-----------|--------|-----------|
| 環境變數 | 低 | 環境隔離 |
| 工作目錄 | 低 | 檔案路徑隔離 |
| `cgroups`（Linux） | 中 | CPU、記憶體限制（見 [資源控制](resource-control.md)） |
| Docker | 高 | 完整容器隔離 |

## 設計原則

1. **單一二進位，執行時零依賴。**
2. **Agent 是大腦；TRL 是雙手。** TRL 只執行與回報。
3. **快速失敗，安全失敗。** 結構化錯誤、強制超時、殭屍清理。
4. **金鑰只透傳，不持久化。**
5. **先 MVP，再擴展。** Unix Socket + 緩衝輸出 + 會話 CRUD = 可交付。
