# OpenClaw Claw Core 插件（简体中文）

[English](README.md) | 简体中文 | [繁體中文](README-zh-Hant.md)

OpenClaw 的 **Claw Core** 终端运行时层插件。安装后，claw_core 会随 OpenClaw 自动启动，代理可使用其进行会话管理的命令执行。

**兼容性：** 参见 [兼容性](#兼容性) 了解 OpenClaw 与 Cursor CLI 版本要求。

## 安装

```bash
openclaw plugins install @wchklaus97hk/claw-core
```

或从本地路径安装（如开发时）：

```bash
openclaw plugins install ./plugin
```

安装后重启 OpenClaw gateway。

### 一键安装（binary 自动下载）

OpenClaw 安装插件时只解压 npm 包，不执行 `npm install`，因此 postinstall 不会运行。**daemon 脚本**（`claw_core_daemon.sh`）会补足：首次执行 `openclaw clawcore start`（或 boot hook）时，若插件 binary 不存在，会从 GitHub Releases 自动下载、配置 `openclaw.json` 并安装 skills。无需手动配置 binary。

## 兼容性

| 依赖 | 测试版本 |
|------|----------|
| **OpenClaw** | 2026.2.13（使用 `openclaw update` 获取最新版） |
| **Cursor CLI** | Cursor IDE 2.5.11 — 包含 `agent` 与 `cursor agent` |

Cursor 集成优先使用 PATH 中的 `agent`，否则使用 `cursor agent`。两者在非交互模式下均需 `--output-format stream-json`。

## 前置条件

**平台：** 仅支持 Linux 与 macOS。不支持 Windows（claw_core 使用 Unix 域套接字与 Unix 专用 API）。

1. **claw_core binary** — 任选其一：
   - **自动下载**（推荐）：执行 `openclaw clawcore start`；daemon 脚本首次运行时会从 GitHub Releases 下载
   - **手动下载预编译**（无需 Rust）：[GitHub Releases](https://github.com/wchklaus97/claw-core/releases) — 解压并加入 PATH 或配置 `binaryPath`
   - `cargo install claw_core`（需要 Rust，若在 crates.io）
   - 从源码构建：`cd /path/to/claw && cargo build --release` — 然后在插件配置中设置 `sourcePath`
   - 在插件配置中设置 `binaryPath` 指向预编译 binary

2. **Python 3** — 供 `claw_core_exec.py` 使用（exec 封装）

## 配置

在 `~/.openclaw/openclaw.json` 的 `plugins.entries.claw-core` 下添加：

```json
{
  "plugins": {
    "entries": {
      "claw-core": {
        "enabled": true,
        "config": {
          "socketPath": "/tmp/trl.sock",
          "binaryPath": "/path/to/claw_core",
          "sourcePath": "/path/to/claw",
          "autoStart": true
        }
      }
    }
  }
}
```

- **binaryPath** — claw_core binary 路径（可选；默认使用 PATH 或 ~/.cargo/bin）
- **socketPath** — Unix 套接字路径（默认 `/tmp/trl.sock`）
- **sourcePath** — 用于从源码构建的 claw 仓库路径（可选）
- **autoStart** — gateway 启动时启动 claw_core（默认 true）

## 插件提供功能

1. **Boot hook** — 当 `autoStart` 为 true 时，在 `gateway:startup` 时启动 claw_core
2. **Skills** — 安装时将所有 skills 复制到 `~/.openclaw/skills/`：
   - claw-core-runtime、claw-core-sessions、claw-core-daemon
   - claw-core-install、claw-core-remove（完整安装/移除流程）
   - cron-helper、cursor-agent、cursor-cron-bridge、plans-mode、status-dashboard、cursor-setup
3. **CLI** — `openclaw clawcore start|stop|restart|status|setup-cursor|teardown`
4. **Gateway RPC** — `clawcore.status`
5. **Cursor CLI 集成** — 自动配置 `openclaw.json` 中的 cliBackends、cursor-dev agent 及 subagents 允许列表
6. **脚本**（包含在插件中，供 skills 使用）：
   - `scripts/claw_core_daemon.sh` — 启动/停止/重启/状态；首次启动时若缺失会自动下载 binary（OpenClaw 不执行 postinstall）
   - `scripts/claw_core_exec.py` — 单次 exec 封装
   - `scripts/cron_helper.py` — 简单 cron 任务创建
   - `scripts/status_dashboard.py` — 显示 sessions、cron 任务、活动
   - `scripts/install-skills-to-openclaw.sh` — 将 skills 复制到 `~/.openclaw/skills/`（postinstall 时执行）
   - `scripts/setup-cursor-integration.js` — 在 openclaw.json 中配置 Cursor CLI 集成
   - `scripts/teardown-openclaw-config.js` — 清理 openclaw.json 和 skills（用于移除/卸载）

Skills 引用 `$PLUGIN_ROOT` 作为脚本路径（插件安装目录，例如 `~/.openclaw/extensions/claw-core`）。

向 agent 说：「Install claw core」或「Remove claw core」— claw-core-install 与 claw-core-remove skills 会执行完整步骤。

## Cursor CLI 集成

插件可配置 OpenClaw 将任务委派给 Cursor CLI：

```bash
# 配置 Cursor 集成（添加 cliBackends、cursor-dev agent、allowAgents）
openclaw clawcore setup-cursor

# 指定自定义 workspace
openclaw clawcore setup-cursor --workspace /path/to/project

# 重启 gateway 使配置生效
openclaw gateway restart
```

首次执行 `openclaw clawcore start`（下载 binary 时）也会自动运行。

或在聊天中对 agent 说：「Set up Cursor integration」。

## 故障排查

- `agentId is not allowed for sessions_spawn`：执行 `openclaw clawcore setup-cursor`，然后 `openclaw gateway restart`
- 找不到 `agent` / `cursor`：安装 Cursor CLI 并确保 `agent` 或 `cursor` 在 PATH 中
- 配置校验错误：执行 `openclaw doctor --fix`，再执行 `openclaw clawcore setup-cursor`

## 手动控制

```bash
openclaw clawcore status
openclaw clawcore start
openclaw clawcore stop
openclaw clawcore teardown   # 停止并清理配置；然后：rm -rf ~/.openclaw/extensions/claw-core
```

## 开发

在 claw 仓库中：

```bash
openclaw plugins install -l ./plugin
```

这会链接插件（不复制），修改即时生效。更改后重启 gateway。
