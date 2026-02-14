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
2. **动作：** 依次执行 `postinstall-download-binary.sh`（从 GitHub Releases 下载 binary）、`postinstall-config-openclaw.js`（在 `openclaw.json` 中设置 `binaryPath`）、`install-skills-to-openclaw.sh`（将 skills 复制到 `~/.openclaw/skills/`）。
3. **之后：** 调用 `find_binary()` 并启动 daemon。

这样可实现一步安装：`openclaw plugins install @wchklaus97hk/claw-core` 后再执行 `openclaw clawcore start`，即可完成安装，无需额外手动操作。

### OpenClaw Skills

插件包含 8 个 skills（规范列表：`scripts/claw-core-skills.list`）：

| Skill | 用途 |
|-------|---------|
| **claw-core-runtime** | 通过 claw_core 执行命令（封装 `claw_core_exec.py`） |
| **claw-core-sessions** | 列出并管理 claw_core 会话 |
| **claw-core-daemon** | 从 Agent 侧启动/停止/查看 daemon |
| **cron-helper** | 定时任务调度辅助 |
| **cursor-agent** | Cursor 代理协调 |
| **cursor-cron-bridge** | Cursor 与定时任务的桥接 |
| **plans-mode** | 规划模式工作流 |
| **status-dashboard** | 状态面板监控 |

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

# 卸载
./scripts/remove-claw-core-openclaw.sh

# 验证
./scripts/verify_integration.sh
```

安装后请重启 OpenClaw gateway。

## 快速参考

- **一步安装：** `openclaw plugins install @wchklaus97hk/claw-core`，然后 `openclaw clawcore start`
- **本地安装：** `./scripts/install-claw-core-openclaw.sh`（用 `--force` 重装）
- **卸载：** `./scripts/remove-claw-core-openclaw.sh`
- **验证：** `./scripts/verify_integration.sh`
- **启动 Runtime：** `openclaw clawcore start` 或 daemon 脚本
- **查看状态：** `openclaw clawcore status`
- **RPC：** 从 gateway 调用 `clawcore.status`
