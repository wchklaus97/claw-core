# 安全與 Token 處理 — 終端 Runtime 層

說明 Runtime 如何處理金鑰、認證與隔離邊界。

## 核心原則

**金鑰只透傳，不持久化。**

Runtime 從 Agent 或啟動設定接收 token 與環境變數，將其傳給子程序，且絕不寫入磁碟。

## Token 流

```
┌──────────────────┐     ┌───────────────────┐     ┌──────────────┐
│  Agent / Config  │────>│  Terminal Runtime │────>│ Child Process│
│  TG_BOT_TOKEN=.. │     │  Holds in memory  │     │  Sees in env │
│  CURSOR_API_KEY= │     │  Never writes disk│     │  at runtime  │
└──────────────────┘     └───────────────────┘     └──────────────┘
```

## 環境變數處理

### 注入點

1. **Runtime 啟動時**：來自 Runtime 自身環境或 `.env` 檔案
2. **建立會話時**：透過 `session.create` 傳入會話層級變數
3. **執行命令時**：透過 `exec.run` / `exec.stream` 傳入命令層級變數

### 作用域規則

| 作用域 | 可見性 | 生命週期 |
|-------|-----------|----------|
| Runtime 級 | 所有會話、所有命令 | 直到 Runtime 重新啟動 |
| 會話級 | 該會話中的所有命令 | 直到會話銷毀 |
| 命令級 | 僅該次命令 | 直到命令結束 |

### 禁止事項

- **禁止記錄環境變數值**：只記錄 key，不記錄 value
- **禁止將環境變數寫碟**：不寫暫存檔案，不匯出設定快照
- **禁止在 API 回應中回傳金鑰**（除非明確需要，且建議脫敏）
- **禁止把金鑰硬編碼進 Runtime 二進位**

## API 認證

### Unix Socket 模式（預設）

- **機制**：依賴 socket 檔案系統權限
- **建議**：socket 權限設為 `0600`（僅擁有者可存取）

### HTTP 模式

- **機制**：Bearer Token 認證
- **Token 來源**：環境變數 `TRL_AUTH_TOKEN`
- **每個請求**：`Authorization: Bearer <token>`
- 若啟用 HTTP 但未設定 `TRL_AUTH_TOKEN`，Runtime 應**拒絕啟動**。

## 隔離邊界

### TRL 能隔離什麼

| 維度 | 做法 |
|--------|-----|
| **環境變數** | 每個會話獨立環境集 |
| **工作目錄** | 每個會話獨立 cwd |
| **程序樹** | 追蹤會話程序，`session.destroy` 可整樹清理 |
| **輸出** | stdout/stderr 按會話與命令隔離 |

### TRL 目前不能隔離什麼（MVP）

| 維度 | 後續方案 |
|--------|------------|
| **檔案系統** | L2：chroot 或 Docker |
| **網路** | L2：network namespaces |
| **資源** | L2：cgroups；見 [資源控制](resource-control.md) |
| **使用者** | L2：按會話切換使用者 |

## 威脅模型（面向 Agent 開發者）

| 威脅 | 緩解方式 |
|--------|-----------|
| Agent 發送惡意命令 | TRL 不做命令語意判斷；安全策略由 Agent 負責。TRL 提供超時與終止機制。 |
| 輸出中洩露金鑰 | Agent 應在展示給使用者前做脫敏。 |
| 未授權 API 存取 | 本機靠 socket 權限，HTTP 靠 bearer token。設定錯誤時應預設安全失敗。 |
| 會話劫持 | Session ID 使用隨機 UUID，避免可枚舉。 |
| 崩潰後殭屍程序 | 週期回收；啟動時清理孤兒程序。 |
| 資源耗盡 | 會話上限、命令超時、setrlimit；見 [資源控制](resource-control.md)。 |

## 部署安全檢查清單

- [x] Runtime 以**非 root** 使用者執行
- [ ] `.env` 權限為 `0600`
- [x] Unix Socket 權限為 `0600`
- [ ] 啟用 HTTP 時已設定 `TRL_AUTH_TOKEN`
- [ ] 日誌中不包含環境變數值
- [x] 已設定最大會話數
- [x] 已設定預設超時
- [ ] Runtime 二進位不可被所有使用者寫入
