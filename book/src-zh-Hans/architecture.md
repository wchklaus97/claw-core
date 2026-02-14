# 架构 — 终端轻量 Runtime 层

这是一个基于 Rust 的执行层，位于 AI 代理（“大脑”）与操作系统之间，负责管理终端会话、运行命令，并通过清晰的 API 返回输出。

## 概览

Terminal Runtime Layer（TRL）解决了一个基础问题：像 OpenClaw 这样的 AI 代理当前常常直接在主机上用原始 `exec` 执行命令。这种方式脆弱、不可控，且无法扩展。

TRL 是**执行舱（execution pod）**：它拥有终端会话，在会话中运行命令，捕获输出，并向代理提供最小 API。

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

## 成熟度分层

| 层级 | 描述 | 变化点 |
|-------|-------------|--------------|
| **L0** | 主机直接 exec | Agent 直接调用 `exec`，无会话管理。 |
| **L1** | 单 Runtime | Agent 与一个 TRL 实例通信，TRL 管理会话并返回输出。 |
| **L2** | 多 Runtime | 多个 TRL 实例（主机、Docker、远程 SSH），Agent 按任务选择。 |

**先做 L1。** API 稳定后，L2 可以自然演进。

## 核心组件

### 1. 会话管理器

负责终端会话生命周期。每个会话包含：

- **Session ID**：唯一标识（UUID 或短哈希）
- **Shell 进程**：底层 shell（bash/zsh）或直接命令
- **工作目录**：每个会话独立
- **环境变量**：继承变量 + 会话级覆盖
- **状态**：`creating`、`idle`、`running`、`terminated`

### 2. 命令执行器

接收执行请求并在会话中运行：

- 用 `std::process::Command` 启动子进程
- 将 stdout/stderr 回传给调用方
- 支持**同步模式**（等待退出）；流式模式计划中
- 强制超时（可按命令或会话配置）

### 3. 输出处理器

- **缓冲模式**：收集全部输出，在进程退出后返回（已实现）
- **流式模式**：输出到达即分块推送（计划中）
- 始终包含：stdout、stderr、exit code、duration

### 4. API 服务

- **传输**：Unix Socket（已实现）；HTTP 与 stdin/stdout（计划中）
- **协议**：JSON 请求/响应
- **认证**：HTTP 用 Token；Unix Socket 用文件权限

### 5. 隔离层（可选）

| 技术 | 成本 | 隔离能力 |
|-----------|--------|-----------|
| 环境变量 | 低 | 环境隔离 |
| 工作目录 | 低 | 文件路径隔离 |
| `cgroups`（Linux） | 中 | CPU、内存限制（见 [资源控制](resource-control.md)） |
| Docker | 高 | 完整容器隔离 |

## 设计原则

1. **单一二进制，运行时零依赖。**
2. **Agent 是大脑；TRL 是双手。** TRL 只执行与回报。
3. **快速失败，安全失败。** 结构化错误、强制超时、僵尸清理。
4. **密钥只透传，不持久化。**
5. **先 MVP，再扩展。** Unix Socket + 缓冲输出 + 会话 CRUD = 可交付。
