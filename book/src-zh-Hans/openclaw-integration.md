# OpenClaw 集成

说明 `claw_core` 如何与 OpenClaw 集成，实现自动启动与受管命令执行。

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
./claw_core_daemon.sh start   # Start
./claw_core_daemon.sh stop    # Stop
./claw_core_daemon.sh restart # Restart
./claw_core_daemon.sh status  # Check status
```

- PID：`/tmp/claw_core.pid`
- 日志：`/tmp/claw_core.log`
- Socket：`/tmp/trl.sock`（或 `$CLAW_CORE_SOCKET`）

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

```bash
# 安装（构建二进制、安装插件、自动配置 openclaw.json）
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

- **安装：** `./scripts/install-claw-core-openclaw.sh`（用 `--force` 重装）
- **卸载：** `./scripts/remove-claw-core-openclaw.sh`
- **验证：** `./scripts/verify_integration.sh`
- **启动 Runtime：** `openclaw clawcore start` 或 daemon 脚本
- **查看状态：** `openclaw clawcore status`
- **RPC：** 从 gateway 调用 `clawcore.status`
