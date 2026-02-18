# OpenClaw 集成

说明 `claw_core` 如何与 OpenClaw 集成，实现自动启动与受管命令执行。

**文档：** [https://wchklaus97.github.io/claw-core/zh-Hans/book/](https://wchklaus97.github.io/claw-core/zh-Hans/book/)

**路径占位符：** `$CLAW_ROOT` = claw 仓库，`$WORKSPACE` = OpenClaw 工作区，`$PLUGIN_ROOT` = 插件安装目录。

## 概览

**claw_core** 是 Rust 实现的终端 Runtime 层，**OpenClaw** 是 AI 代理框架。该集成使 OpenClaw 能够：

1. 网关启动时自动启动 **claw_core**（通过 boot hook）
2. 在可用时优先使用 **claw_core** 执行命令
3. 通过 skills 管理 **claw_core** 生命周期
4. 当 **claw_core** 不可用时平滑降级到普通 `exec`

## 插件功能与说明（v0.1.7）

claw-core 插件提供以下能力。

### CLI 命令

| 命令 | 用途 |
|------|------|
| `openclaw clawcore start \| stop \| restart \| status` | 守护进程生命周期 |
| `openclaw clawcore setup-cursor` | 配置 Cursor CLI 并创建工作区 |
| `openclaw clawcore init-workspace` | 创建含 shared_memory、shared_skills、generated/ 的工作区 |
| `openclaw clawcore reset-workspace` | 重置工作区（会备份 shared_memory） |
| `openclaw clawcore setup-bots` | 一键配置 3 个 Telegram 机器人（artist、assistant、developer） |
| `openclaw clawcore team` | 代理团队：创建、setup-telegram、列表 |
| `openclaw clawcore teardown` | 停止守护进程并清理 |
| `openclaw picoclaw status \| config \| chat "<消息>"` | PicoClaw（可选） |

### 代理工具

| 工具 | 用途 |
|------|------|
| `cursor_agent_direct` | 调用 Cursor Agent 进行编程与复杂任务；输出写入工作区（Cursor CLI 不支持图片生成）。支持模式：**agent**（执行）、**plan**（先规划后执行）、**ask**（只读）。测试说明见 [CURSOR_CLI_MODES_TESTING.md](../plugin/docs/CURSOR_CLI_MODES_TESTING.md)。 |
| `picoclaw_chat` | 向 PicoClaw 发送消息，用于快速问答与网页搜索（可选；尚未测试） |
| `picoclaw_config` | 查看或设置 PicoClaw 配置（可选；尚未测试） |
| `team_coordinate` | 管理团队任务板与协作 |

### 工作区与多机器人

- **默认工作区：** `~/Documents/claw_core`（或通过 `defaultWorkspace` 与 `--workspace` 自定义）。
- **工作区结构：** `shared_memory/`、`shared_skills/`、`projects/`、`generated/exports/`。
- **按代理工作区：** Telegram 机器人使用 `~/.openclaw/workspace-{bot_id}/`；工作区可按代理解析或显式传给工具。

### 代理团队

- 多代理协作与共享任务板。
- 通过 `openclaw clawcore team setup-telegram` 配置 Telegram 群组。
- 工具与技能：`team_coordinate`，team-lead、team-member、team-telegram-group。

## 架构

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

## 组件

### Boot Hook

**位置：** 插件 hook `boot-claw-core`（或 `$WORKSPACE/BOOT.md`）

在 `gateway:startup` 事件触发时调用，并通过 daemon 脚本启动 claw_core。

### Daemon 管理脚本

**位置：** `$PLUGIN_ROOT/scripts/claw_core_daemon.sh` 或 `$CLAW_ROOT/scripts/claw_core_daemon.sh`

```bash
./claw_core_daemon.sh start   # 启动
./claw_core_daemon.sh stop    # 停止
./claw_core_daemon.sh restart # 重启
./claw_core_daemon.sh status  # 查看状态
```

- PID：`/tmp/claw_core.pid`
- 日志：`/tmp/claw_core.log`
- Socket：`/tmp/trl.sock`（或 `$CLAW_CORE_SOCKET`）

**自动下载 binary：** OpenClaw 安装插件时只解压 npm 包，不执行 `npm install`，因此 postinstall 不会运行。daemon 脚本会补齐：首次执行 `start` 时，若插件 binary 不存在（且未设置 `CLAW_CORE_BINARY` / `CLAW_CORE_SOURCE`），会自动从 GitHub Releases 下载 binary、配置 `openclaw.json` 并安装 skills。一步安装：`openclaw plugins install @wchklaus97hk/claw-core`，然后执行 `openclaw clawcore start`。

### 实现：Daemon 自动下载

**问题：** OpenClaw 安装插件时只解压 npm 包，不在解压目录中执行 `npm install`，因此 `postinstall` 脚本（binary 下载、配置、skills）不会运行。

**方案：** daemon 脚本（`claw_core_daemon.sh`）在 `start` 被调用且插件 binary 缺失时，补全缺失的安装步骤。在 `start()` 中：

1. **条件：** 未设置 `CLAW_CORE_BINARY` 和 `CLAW_CORE_SOURCE`，且 `$PLUGIN_ROOT/bin/claw_core` 不存在。
2. **动作：** 依次执行 `postinstall-download-binary.sh`（从 GitHub Releases 下载 binary）、`postinstall-config-openclaw.cjs`（在 `openclaw.json` 中设置 `binaryPath`）、`install-skills-to-openclaw.sh`（将 skills 复制到 `~/.openclaw/skills/`）、`setup-cursor-integration.cjs`（在 `openclaw.json` 中配置 Cursor 集成）。
3. **之后：** 调用 `find_binary()` 并启动 daemon。

这样可实现一步安装：`openclaw plugins install @wchklaus97hk/claw-core` 后再执行 `openclaw clawcore start`，即可完成安装，无需额外手动操作。

### OpenClaw Skills

插件包含 12+ 个 skills（规范列表：`scripts/claw-core-skills.list`）：

| Skill | 用途 |
|-------|---------|
| **claw-core-runtime** | 通过 claw_core 执行命令（封装 `claw_core_exec.py`） |
| **claw-core-sessions** | 列出并管理 claw_core 会话 |
| **claw-core-daemon** | 从 Agent 侧启动/停止/查看 daemon |
| **claw-core-install** | 完整安装或补充安装（plugins install、daemon start、Cursor 设置） |
| **claw-core-remove** | 完整卸载（停止 daemon、清理配置、移除 skills 与插件） |
| **cron-helper** | 定时任务调度辅助 |
| **cursor-agent** | Cursor 代理协调 |
| **cursor-cron-bridge** | Cursor 与定时任务的桥接 |
| **plans-mode** | 规划模式工作流 |
| **status-dashboard** | 状态面板监控 |
| **cursor-setup** | 在 `openclaw.json` 中配置 Cursor CLI 集成 |
| **claw-core-workspace** | 如何在 claw_core 工作区内工作（阅读 WORKSPACE.md，使用 shared_memory、shared_skills） |

### 安装 / 卸载

**一步安装（npm）：**

```bash
openclaw plugins install @wchklaus97hk/claw-core
openclaw clawcore start   # 首次运行 daemon 自动下载 binary
```

**本地/开发安装（构建二进制、安装插件、自动配置 openclaw.json）：**

```bash
# 安装
./scripts/install-claw-core-openclaw.sh

# 重新安装
./scripts/install-claw-core-openclaw.sh --force

# 卸载（同时清理 openclaw.json 中的 Cursor 集成）
./scripts/remove-claw-core-openclaw.sh

# 验证
./scripts/verify_integration.sh
```

安装后请重启 OpenClaw gateway。

## Cursor CLI 集成

插件可以配置 OpenClaw 将任务委派给 Cursor CLI，包括：

- **cliBackends**：`cursor-cli`、`cursor-plan`、`cursor-ask`（Agent、Plan、Ask 模式）
- **cursor-dev agent**：使用 `cursor-cli/auto` 作为模型
- **subagents.allowAgents**：允许主 Agent 将任务派给 cursor-dev

**为何需要：** OpenClaw 安装插件时只解压 npm 包，不执行 `npm install`，因此 postinstall 不会运行。daemon 脚本会在首次启动时执行 `setup-cursor-integration.cjs` 补全配置。若自动设置被跳过或需重新配置，请使用下方手动步骤。

### 分步设置

1. **安装插件：** `openclaw plugins install @wchklaus97hk/claw-core`
2. **启动 daemon（自动配置）：** `openclaw clawcore start` — 首次运行会下载 binary 并在 `openclaw.json` 中配置 Cursor
3. **可选手动设置：** 若 Cursor 集成缺失或需指定其他 workspace：`openclaw clawcore setup-cursor`（或 `--workspace /path/to/project`）
4. **重启 gateway：** `openclaw gateway restart`

### 工作区结构

运行 `openclaw clawcore setup-cursor` 时，会创建并配置 Cursor 代理的工作目录（**工作区**）。默认路径为 `~/Documents/claw_core`。

| 路径 | 用途 |
|------|------|
| `shared_memory/` | 每日日志（`YYYY-MM-DD.md`）、长期笔记、主题文件 — 跨会话持久化上下文 |
| `shared_skills/` | 所有代理可用的技能（superpowers 工作流、claw-core-workspace、model-selection-agent 等） |
| `projects/` | 外部仓库的符号链接或克隆 — 在 `projects/repo-name/` 内工作，保持在工作区内 |
| `generated/exports/` | 生成产物 |

`setup-cursor` 会调用 `init-workspace.cjs`，后者会复制 `WORKSPACE.md` 与 `.gitignore`，并从 `default-skills.json` 安装默认技能到 `shared_skills/`。高级用户可运行 `node $PLUGIN_ROOT/scripts/init-workspace.cjs init`（或 `reset`）来重新初始化或重置工作区。

### 依赖

- **Cursor CLI** 在 PATH 中（`agent` 或 `cursor` — 有 `agent` 时优先使用）
- **Cursor 登录：** 执行 `agent login` 或 `cursor agent login` 或设置 `CURSOR_API_KEY`

### 自动设置（首次启动）

`openclaw clawcore start` 首次执行下载 binary 时，会自动执行 `setup-cursor-integration.cjs`。

### 手动设置

```bash
# 一行命令：配置 Cursor 并重启 gateway
openclaw clawcore setup-cursor && openclaw gateway restart

# 使用默认 workspace
openclaw clawcore setup-cursor

# 指定 workspace
openclaw clawcore setup-cursor --workspace /path/to/project

# 重启 gateway
openclaw gateway restart
```

### 通过 Agent 聊天

告诉 Agent："设置 Cursor 集成" 或 "set up Cursor integration"。Agent 会使用 `cursor-setup` skill。

### 会写入 openclaw.json 的配置

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

### 故障排查

- **`agentId is not allowed for sessions_spawn`**：执行 `openclaw clawcore setup-cursor`，然后执行 `openclaw gateway restart`
- **找不到 `agent` / `cursor` 命令**：安装 Cursor CLI 并确认 `agent` 或 `cursor` 在 PATH 中
- **配置 schema 错误**：先执行 `openclaw doctor --fix`，再重新执行 `openclaw clawcore setup-cursor`

## PicoClaw（可选，尚未测试）

插件（v0.1.7）可集成 [PicoClaw](https://github.com/sipeed/picoclaw)，用于快速问答与网页搜索。

- **工具：** `picoclaw_chat`（发送消息）、`picoclaw_config`（查看/设置模型、提供商、语言）
- **CLI：** `openclaw picoclaw status | config | chat "<消息>"`
- **配置：** 若已安装 PicoClaw，可在插件配置中设置 `picoClawPath` 和 `enablePicoClaw: true`。

**说明：** PicoClaw 集成**尚未经过测试**，仅作为可选功能提供。如需尝试，请从 https://github.com/sipeed/picoclaw 安装 PicoClaw。

## ZeroClaw 支持（实验性，尚未测试）

[ZeroClaw](https://github.com/ArcadeLabsInc/zeroclaw) 是一个独立的全 Rust AI 代理运行时，专注于性能、最小二进制大小和安全性。与 OpenClaw（Node.js/npm）不同，ZeroClaw 不使用 npm 插件系统，因此 OpenClaw 插件无法直接在其中运行。

然而，`claw_core` 守护进程协议（Unix socket 上的 JSON）与**运行时无关**。我们提供了一个独立的 Rust crate — [`claw-core-protocol`](https://crates.io/crates/claw-core-protocol) — 为 ZeroClaw（或任何 Rust 程序）提供类型化的异步客户端来连接守护进程。

### 工作原理

1. **安装 crate：** 该 crate 已发布到 crates.io，也可作为路径依赖从 `crates/claw-core-protocol/` 获取。
2. **功能标志：** ZeroClaw 通过 `cargo install zeroclaw --features claw-core` 进行集成。
3. **运行时：** 当 `claw-core` 功能启用且 ZeroClaw 配置中 `claw_core.enabled = true` 时，会注册一个 `ClawCoreExecTool`。它连接到同一个守护进程 socket，创建会话并执行命令 — 与 OpenClaw 插件的方式相同。

### 架构

```
ZeroClaw（Rust 二进制）
  └─ claw-core 功能标志
       └─ claw-core-protocol crate
            └─ Unix socket ─── claw_core 守护进程
```

### 状态

> **此集成尚未经过测试。** `claw-core-protocol` crate 可以编译，架构已就绪，但尚未在 ZeroClaw + claw_core 守护进程的完整环境中进行端到端测试。使用风险自负，如有问题请在 GitHub 上反馈。

详情请参阅 [`crates/claw-core-protocol/README.md`](https://github.com/wchklaus97/claw-core/tree/main/crates/claw-core-protocol)。

## 快速参考

- **一步安装：** `openclaw plugins install @wchklaus97hk/claw-core`，然后 `openclaw clawcore start`
- **本地安装：** `./scripts/install-claw-core-openclaw.sh`（用 `--force` 重装）
- **卸载：** `./scripts/remove-claw-core-openclaw.sh`
- **验证：** `./scripts/verify_integration.sh`
- **启动 Runtime：** `openclaw clawcore start` 或 daemon 脚本
- **查看状态：** `openclaw clawcore status`
- **设置 Cursor：** `openclaw clawcore setup-cursor`
- **RPC：** 从 gateway 调用 `clawcore.status`
