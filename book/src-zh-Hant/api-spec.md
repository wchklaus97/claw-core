# API 規範 — 終端 Runtime 層

定義代理與 Runtime 層通訊所用的協定與端點。

## 傳輸

| 模式 | 適用情境 | 說明 |
|------|------------|---------|
| **Unix Socket** | 本機、同機 | 預設。快且安全（檔案權限）。路徑：`/tmp/trl-<instance>.sock` |
| **HTTP** | 遠端、Docker、多主機 | 綁定 `127.0.0.1:<port>`。必須啟用 Token 認證。 |
| **Stdin/Stdout** | CLI 測試、管道呼叫 | 一次性模式。從 stdin 讀 JSON，向 stdout 寫 JSON。 |

## 協定

全部訊息均為 **JSON**。每個請求包含 `method` 和可選 `params`。每個回應包含 `ok`（bool）、可選 `data` 與可選 `error`。

### 請求格式

```json
{
  "id": "req-001",
  "method": "session.create",
  "params": {
    "shell": "/bin/zsh",
    "env": {"MY_VAR": "value"},
    "working_dir": "/tmp/sandbox"
  }
}
```

### 回應格式（成功）

```json
{
  "id": "req-001",
  "ok": true,
  "data": {
    "session_id": "s-a1b2c3",
    "created_at": "2026-02-13T12:00:00Z"
  }
}
```

### 回應格式（失敗）

```json
{
  "id": "req-001",
  "ok": false,
  "error": {
    "code": "SESSION_NOT_FOUND",
    "message": "No session with id 's-xyz'"
  }
}
```

## 方法

### 會話管理

#### `session.create`

建立一個新的終端會話。

**參數：**

| 欄位 | 類型 | 必填 | 預設值 | 描述 |
|-------|------|----------|---------|-------------|
| `shell` | string | 否 | `/bin/sh` | 會話使用的 shell |
| `env` | object | 否 | `{}` | 額外環境變數 |
| `working_dir` | string | 否 | `/tmp` | 初始工作目錄 |
| `name` | string | 否 | `null` | 人類可讀的會話標籤 |
| `timeout_s` | int | 否 | `0`（不限制） | 會話預設命令超時 |

**回傳資料：** `session_id`、`shell`、`working_dir`、`state`、`created_at`

---

#### `session.list`

列出所有活躍會話。**參數：** 無。

---

#### `session.info`

取得指定會話詳情。**參數：** `session_id`（必填）。

---

#### `session.destroy`

終止並清理會話。**參數：** `session_id`（必填）、`force`（可選 bool）。

---

### 命令執行

#### `exec.run`

在會話中執行命令（緩衝模式），等待命令完成。

**參數：** `session_id`、`command`、`timeout_s`、`stdin`、`env`

**回傳資料：** `stdout`、`stderr`、`exit_code`、`duration_ms`、`timed_out`

---

#### `exec.stream`

以即時串流輸出執行命令。先回傳 `stream_id`，然後持續推送輸出塊。

---

#### `exec.cancel`

取消正在執行的命令。**參數：** `session_id`、`signal`（可選）。

---

### 系統

#### `system.ping`

健康檢查。回傳：`uptime_s`、`version`。

#### `system.stats`

Runtime 統計：`active_sessions`、`total_commands_run`、`uptime_s`、`memory_rss_bytes`。

---

## 錯誤碼

| Code | 含義 |
|------|---------|
| `SESSION_NOT_FOUND` | 指定 ID 的會話不存在 |
| `SESSION_BUSY` | 會話正在執行命令 |
| `COMMAND_TIMEOUT` | 命令超時 |
| `COMMAND_FAILED` | 命令非零結束 |
| `INVALID_PARAMS` | 參數缺失或格式錯誤 |
| `INTERNAL_ERROR` | Runtime 內部異常 |
| `AUTH_FAILED` | 認證 Token 無效或缺失 |

---

## 認證（HTTP 模式）

在 HTTP 模式下，請求必須包含：

```
Authorization: Bearer <token>
```

啟動 Runtime 時透過環境變數 `TRL_AUTH_TOKEN` 設定 Token。Unix Socket 模式依賴檔案系統權限進行存取控制。
