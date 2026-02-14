# 會話生命週期 — 終端 Runtime 層

說明 Runtime 層中終端會話如何被建立、使用與銷毀。

## 會話狀態

```
                    session.create
                         │
                         ▼
                    ┌──────────┐
                    │ CREATING │  初始化 shell、env、cwd
                    └────┬─────┘
                         │ success
                         ▼
              ┌─────────────────────┐
         ┌───>│        IDLE         │<────────────┐
         │    │   可接收新命令      │              │
         │    └─────────┬───────────┘              │
         │              │ exec.run / exec.stream   │
         │              ▼                          │
         │    ┌──────────────────┐                 │
         │    │     RUNNING      │  命令執行中      │
         │    │  stdout/stderr   │                 │
         │    │  輸出持續產生      │                 │
         │    └────────┬─────────┘                 │
         │             │                           │
         │     ┌───────┴────────┐                  │
         │     │                │                  │
         │  exit/timeout    cancel                 │
         │     │                │                  │
         │     ▼                ▼                  │
         │  回傳結果          已取消                │
         └────────────────────┴────────────────────┘
                         │
                  session.destroy
                         │
                         ▼
                  ┌──────────────┐
                  │  TERMINATED  │  已清理
                  └──────────────┘
```

## 狀態說明

| 狀態 | 描述 | 允許操作 |
|-------|-------------|-----------------|
| **CREATING** | Shell 程序正在啟動 | 等待（僅內部） |
| **IDLE** | 會話存活，當前無命令執行 | `exec.run`、`exec.stream`、`session.destroy`、`session.info` |
| **RUNNING** | 命令正在執行 | `exec.cancel`、`session.info`、`session.destroy` |
| **TERMINATED** | 會話已結束並清理 | `session.info`（唯讀） |

## 建立會話

呼叫 `session.create` 時，Runtime 會：

1. 產生會話 ID（例如 `s-a1b2c3`）
2. 解析 shell（傳入值或 `/bin/sh`）
3. 準備環境（Runtime 基礎環境 + 會話覆蓋）
4. 設定工作目錄
5. 啟動 shell 程序
6. 註冊到會話池
7. 回傳會話元資料

### 失敗情境

| 失敗類型 | 處理方式 |
|---------|----------|
| 未找到 shell 二進位 | 回傳錯誤，不建立會話 |
| 活躍會話過多 | 回傳 `MAX_SESSIONS_REACHED` |
| Shell 啟動即崩潰 | 回傳錯誤並清理 |

## 會話內命令執行

### 緩衝模式（`exec.run`）

1. Agent 發送 `exec.run`（包含會話 ID 與命令）
2. TRL 檢查會話狀態為 `IDLE`
3. TRL 將命令寫入會話 shell 的 stdin
4. TRL 持續讀取 stdout/stderr，直到命令完成（或超時）
5. TRL 記錄結束碼，會話回到 `IDLE`
6. TRL 回傳 `{stdout, stderr, exit_code, duration_ms}`

### 串流模式（`exec.stream`）

1. Agent 發送 `exec.stream`；TRL 回傳 `stream_id`
2. TRL 將命令寫入 shell stdin
3. 輸出到達時，TRL 分塊推送給 Agent
4. 命令結束時，TRL 推送最終 `exit` 塊；會話回到 `IDLE`

### 超時處理

當觸發超時：

1. 向該命令程序組發送 `SIGTERM`
2. 等待 5 秒
3. 若仍存活，發送 `SIGKILL`
4. 回傳結果並設定 `timed_out: true`
5. 會話回到 `IDLE`（會話本身不被銷毀）

## 銷毀會話

呼叫 `session.destroy` 時：

1. 若有命令執行，先取消（SIGTERM → SIGKILL）
2. 向會話 shell 程序發送 SIGTERM
3. 最多等待 5 秒優雅結束
4. 若 `force: true` 或超出寬限期，則發送 SIGKILL
5. 關閉全部管道並從會話池移除

### 殭屍程序防護

- 使用會自動回收子程序的非同步程序處理
- 週期性掃描孤兒 PID
- Runtime 結束時銷毀所有活躍會話

## 會話池管理

- **max_sessions**：可設定上限
- **Housekeeping**：週期清理陳舊/空閒/死亡會話
- **Concurrency**：可並行多會話；單會話在緩衝模式下順序執行
