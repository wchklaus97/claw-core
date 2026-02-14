# Claw Core

用于封装并运行代理 CLI 命令的**核心执行层**。它管理终端会话，按超时执行命令，并通过清晰的 JSON API 返回结构化输出。

## 这是什么？

**Claw Core** 是代理 CLI 的封装核心，是 AI 代理与操作系统之间的中间层。代理会运行 CLI 命令（例如 `cursor agent`、`npm run`、shell 脚本）；Claw Core 用会话、超时和结构化输出来封装这些执行。

与其让代理直接在主机上调用 `exec`（脆弱、不可控、难扩展），不如让代理通过 **Claw Core** 这个轻量 Runtime 来执行：

- **管理会话**：创建、列出、查看、销毁终端会话
- **执行命令**：支持缓冲模式或流式模式，并强制超时
- **处理密钥**：将环境变量传给进程，但不落盘
- **提供清晰 API**：通过 Unix Socket、HTTP 或 stdin/stdout 传输 JSON

```
Agent（CLI commands） ──JSON──> Claw Core（packing core） ──fork/exec──> OS processes
```

## 快速开始

### 安装（无需 Rust）

从 [GitHub Releases](https://github.com/wchklaus97/claw-core/releases) 下载预编译二进制，或者：

```bash
curl -sSL https://raw.githubusercontent.com/your-org/claw/main/scripts/install-from-release.sh | bash -s v0.1.0
```

### 运行 Runtime

```bash
cargo run -- --socket-path /tmp/trl.sock
# Or: claw_core --socket-path /tmp/trl.sock
```

### 探测 Runtime

```bash
echo '{"id":"1","method":"system.ping","params":{}}' | socat - UNIX-CONNECT:/tmp/trl.sock
```

## 设计原则

1. **单一二进制，零运行时依赖**：只需 Rust
2. **Agent 是大脑，TRL 是双手**：TRL 不决定执行什么
3. **快速失败，安全失败**：结构化错误、强制超时、僵尸进程清理
4. **密钥只透传，不持久化**：环境变量流转但不写盘
5. **先 MVP 再扩展**：Unix Socket + 缓冲执行 + 会话 CRUD = 可交付

## 状态

**阶段：Production v1**（Unix Socket + 缓冲执行）

- [x] MVP：`system.ping`、`session.*`、`exec.run`、`system.stats`
- [x] 测试与 CI
- [ ] 流式支持
- [ ] HTTP 传输
- [ ] 多 Runtime 支持（L2）
