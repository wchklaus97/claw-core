# Claw Core

用於封裝並執行代理 CLI 命令的**核心執行層**。它管理終端會話，依超時執行命令，並透過清晰的 JSON API 回傳結構化輸出。

## 這是什麼？

**Claw Core** 是代理 CLI 的封裝核心，是 AI 代理與作業系統之間的中間層。代理會執行 CLI 命令（例如 `cursor agent`、`npm run`、shell 腳本）；Claw Core 用會話、超時和結構化輸出來封裝這些執行。

與其讓代理直接在主機上呼叫 `exec`（脆弱、不可控、難擴展），不如讓代理透過 **Claw Core** 這個輕量 Runtime 來執行：

- **管理會話**：建立、列出、檢視、銷毀終端會話
- **執行命令**：支援緩衝模式或串流模式，並強制超時
- **處理金鑰**：將環境變數傳給程序，但不落碟
- **提供清晰 API**：透過 Unix Socket、HTTP 或 stdin/stdout 傳輸 JSON

```
Agent（CLI commands） ──JSON──> Claw Core（packing core） ──fork/exec──> OS processes
```

## 快速開始

### 安裝（無需 Rust）

從 [GitHub Releases](https://github.com/wchklaus97/claw-core/releases) 下載預編譯二進位，或者：

```bash
curl -sSL https://raw.githubusercontent.com/your-org/claw/main/scripts/install-from-release.sh | bash -s v0.1.0
```

### 執行 Runtime

```bash
cargo run -- --socket-path /tmp/trl.sock
# Or: claw_core --socket-path /tmp/trl.sock
```

### 偵測 Runtime

```bash
echo '{"id":"1","method":"system.ping","params":{}}' | socat - UNIX-CONNECT:/tmp/trl.sock
```

## 設計原則

1. **單一二進位，零執行時依賴**：只需 Rust
2. **Agent 是大腦，TRL 是雙手**：TRL 不決定執行什麼
3. **快速失敗，安全失敗**：結構化錯誤、強制超時、殭屍程序清理
4. **金鑰只透傳，不持久化**：環境變數流轉但不寫碟
5. **先 MVP 再擴展**：Unix Socket + 緩衝執行 + 會話 CRUD = 可交付

## 狀態

**階段：Production v1**（Unix Socket + 緩衝執行）

- [x] MVP：`system.ping`、`session.*`、`exec.run`、`system.stats`
- [x] 測試與 CI
- [ ] 串流支援
- [ ] HTTP 傳輸
- [ ] 多 Runtime 支援（L2）
