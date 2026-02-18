# Claw Core（简体中文）

[![Rust](https://img.shields.io/badge/Rust-stable-orange?logo=rust)](https://www.rust-lang.org/)
![Version](https://img.shields.io/badge/version-0.1.0-blue)
[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)

![Claw Core 横幅](assets/images/claw-core-hero-banner.jpeg)

Agent CLI 执行运行时：稳定、可控、可观测的命令执行核心。

完全支持 OpenClaw，并提供用于 OpenClaw 工作流的 Cursor 插件集成（`plugin/`）。测试版本：OpenClaw 2026.2.13、Cursor IDE 2.5.11，详见 [插件说明](plugin/README-zh-Hans.md#兼容性)。

> **CLI 集成状态：** Cursor CLI 与 Codex CLI 集成已可用但尚未完全整合；Kilo Code 尚未运行或测试。详见 [插件 README](plugin/README-zh-Hans.md)。
>
> 插件以本地子进程方式封装 Cursor CLI，符合 Cursor 服务条款（§1.5、§6）。ToS 截图（最后更新 2026-01-13）：[`assets/images/cursor-tos-screenshot.png`](assets/images/cursor-tos-screenshot.png)

---

## What（是什么）

Claw Core 是 AI 代理与操作系统进程之间的 Rust 运行时层。  
代理通过 JSON 协议调用 Claw Core，而不是直接 `exec`。

```text
Agent / Gateway  -->  Claw Core (JSON API)  -->  OS processes
```

---

## Why（为什么）

直接让代理执行系统命令，在线上通常会出现不稳定、不可控、难排查的问题。  
Claw Core 用统一执行模型把这些风险前置解决。

---

## 解决的问题

| 问题 | Claw Core 的解法 |
|---|---|
| 失控进程 | 命令/会话超时与自动清理 |
| 会话混乱 | 明确会话生命周期与隔离边界 |
| 结果不统一 | 标准化 JSON 响应 |
| 可观测性差 | 运行时统计与健康检查接口 |
| 密钥风险 | 环境变量透传，不落盘 |
| OpenClaw 对接复杂 | 通过 Cursor 插件直接接入 OpenClaw 真实工作流 |

---

## How（如何工作）

| 步骤 | 说明 |
|---|---|
| 1 | 代理发送 JSON 请求（`system.ping`、`session.*`、`exec.run`、`system.stats`） |
| 2 | Claw Core 校验并分发到对应模块 |
| 3 | 执行器按超时策略执行并采集输出 |
| 4 | 返回结构化响应给调用方 |

---

## 快速开始

### 前置依赖

| 依赖 | 说明 |
|---|---|
| Rust stable | `rustup toolchain install stable` |
| `socat` | 本地 socket 探测 |

### 启动

```bash
cargo run -- --socket-path /tmp/trl.sock
```

### 探测

```bash
echo '{"id":"1","method":"system.ping","params":{}}' | socat - UNIX-CONNECT:/tmp/trl.sock
```

### 测试

```bash
cargo test
./scripts/smoke.sh
```

### 推送前检查

运行 pre-push 脚本验证核心运行时与 release 构建：

```bash
./scripts/pre-push-test.sh
```

若已安装 OpenClaw，可加 `--openclaw` 验证插件集成：

```bash
./scripts/pre-push-test.sh --openclaw
```

参见 [verify_integration.sh](scripts/verify_integration.sh) 与 [插件说明](plugin/README-zh-Hans.md) 完成 OpenClaw 配置。一步安装：`openclaw plugins install @wchklaus97hk/claw-core`，首次执行 `openclaw clawcore start` 时 daemon 会自动下载 binary（OpenClaw 不运行 npm postinstall）。

---

## Build 与 Deploy

### 本地构建

```bash
cargo build --release
```

### 版本发布

| 平台 | 架构 |
|---|---|
| Linux | `x86_64`、`aarch64` |
| macOS | `x86_64`、`aarch64` |
| Windows | 不支持（依赖 Unix domain socket、rlimit 等 Unix 专属 API） |

发布工作流：`.github/workflows/release.yml` — 推送 `v*` 标签触发（例如 `v0.1.0`）。

---

## 版本策略

当前版本：`0.1.0` — 发布以 git tag `v*` 为准。

推荐流程：

1. 更新 `Cargo.toml` 版本
2. 提交代码
3. 打并推送标签：`git tag v0.1.0 && git push origin v0.1.0`
4. 自动产出发布包

---

## 项目结构

```text
claw/
├── src/                   # runtime 实现
├── tests/                 # 单元/集成测试
├── scripts/               # smoke 与辅助脚本
├── plugin/                # 用于 OpenClaw 的 Cursor 插件集成
├── .github/workflows/     # CI 与发布流程
├── README.md
├── README-zh-Hans.md
└── README-zh-Hant.md
```

---

## 测试

### 1. 插件安装与初始化

| # | 测试项 | 命令 | 预期结果 |
|---|--------|------|----------|
| 1.1 | 从 npm 安装 | `openclaw plugins install @wchklaus97hk/claw-core` | 插件解压成功，无报错 |
| 1.2 | 插件已加载 | `openclaw clawcore status` | 显示插件路径与状态 |
| 1.3 | Skills 已安装 | `ls ~/.openclaw/skills/` | Skills 目录存在 |
| 1.4 | 卸载 | `openclaw plugins uninstall @wchklaus97hk/claw-core` | 清理完整 |

### 2. Daemon 生命周期

| # | 测试项 | 命令 / Telegram | 预期结果 |
|---|--------|----------------|----------|
| 2.1 | 启动 daemon | `openclaw clawcore start` | PID 文件在 `/tmp/claw_core.pid`，socket 在 `/tmp/trl.sock` |
| 2.2 | 状态检查 | `openclaw clawcore status` | 运行中，显示 PID |
| 2.3 | Ping 探测 | `echo '{"id":"1","method":"system.ping","params":{}}' \| socat - UNIX-CONNECT:/tmp/trl.sock` | 返回 `"pong"` |
| 2.4 | 重启 | `openclaw clawcore restart` | 新 PID，socket 存活 |
| 2.5 | 停止 | `openclaw clawcore stop` | PID 文件删除，socket 消失 |
| 2.6 | 自动启动（boot hook） | `openclaw gateway restart` | Daemon 自动启动 |
| 2.7 | **Telegram** | `clawcore status` | Bot 回复 daemon 状态 |
| 2.8 | **Telegram** | `start the claw_core daemon` | Bot 启动 daemon，确认 |

### 3. 工作区初始化

| # | 测试项 | 命令 / Telegram | 预期结果 |
|---|--------|----------------|----------|
| 3.1 | 初始化工作区 | `openclaw clawcore init-workspace` | 创建 `~/Documents/claw_core/`，含 shared_memory、shared_skills、generated/ |
| 3.2 | 验证目录结构 | `ls ~/Documents/claw_core/` | 包含 `shared_memory/`、`shared_skills/`、`projects/`、`generated/images/`、`generated/exports/` |
| 3.3 | 配置 Cursor | `openclaw clawcore setup-cursor` | 更新 `openclaw.json`，写入 cliBackends 与 cursor-dev agent |
| 3.4 | 自定义工作区 | `openclaw clawcore setup-cursor --workspace /tmp/test-ws` | 在指定路径创建工作区 |
| 3.5 | 重置工作区 | `openclaw clawcore reset-workspace` | 重置工作区，备份 shared_memory |
| 3.6 | **Telegram** | `set up the Cursor integration` | Bot 执行 setup-cursor，确认 |
| 3.7 | **Telegram** | `initialize my workspace` | Bot 创建工作区，列出内容 |

### 4. 命令执行（exec.run）

| # | 测试项 | 命令 / Telegram | 预期结果 |
|---|--------|----------------|----------|
| 4.1 | 简单命令 | `echo '{"id":"2","method":"exec.run","params":{"session_id":"...","command":"echo hello"}}' \| socat - UNIX-CONNECT:/tmp/trl.sock` | `stdout: "hello\n"`，exit_code 0 |
| 4.2 | 超时 | exec.run 设 `timeout_s: 2` 执行 `sleep 10` | 返回超时错误 |
| 4.3 | 环境变量透传 | exec.run 设 `env: {"FOO":"bar"}` 执行 `echo $FOO` | `stdout: "bar\n"` |
| 4.4 | **Telegram** | `run the command: echo "hello from claw_core"` | Bot 通过 claw_core 执行，返回输出 |
| 4.5 | **Telegram** | `run: ls -la ~/Documents/claw_core/` | 返回工作区列表 |

### 5. 会话管理

| # | 测试项 | 命令 / Telegram | 预期结果 |
|---|--------|----------------|----------|
| 5.1 | 创建会话 | `session.create` RPC | 返回 session_id |
| 5.2 | 列出会话 | `session.list` RPC | 显示活跃会话 |
| 5.3 | 会话详情 | `session.info` RPC | 返回会话信息 |
| 5.4 | 销毁会话 | `session.destroy` RPC | 会话移除 |
| 5.5 | **Telegram** | `list active claw_core sessions` | Bot 返回会话列表 |
| 5.6 | **Telegram** | `clean up all sessions` | Bot 销毁空闲会话 |

### 6. Cursor Agent 集成

| # | 测试项 | 命令 / Telegram | 预期结果 |
|---|--------|----------------|----------|
| 6.1 | 直接调用 | `cursor_agent_direct` 工具调用 | Cursor agent 在工作区执行任务 |
| 6.2 | Plan 模式 | `cursor-plan` backend | Cursor 以 plan 模式响应 |
| 6.3 | Ask 模式 | `cursor-ask` backend | Cursor 以 ask 模式响应 |
| 6.4 | **Telegram** | `ask Cursor to explain what claw_core does` | Bot 调用 cursor_agent_direct，返回解释 |
| 6.5 | **Telegram** | `use Cursor to write a hello world Python script` | Bot 调用 Cursor，文件在工作区生成 |

### 7. Codex Agent 集成

| # | 测试项 | 命令 / Telegram | 预期结果 |
|---|--------|----------------|----------|
| 7.1 | 检查安装 | `python3 plugin/scripts/codex_agent_direct.py --check` | 返回已安装 + 版本 |
| 7.2 | 直接调用 | `codex_agent_direct` 工具调用 | Codex 在工作区执行任务 |
| 7.3 | 指定模型 | 工具调用设 `model: gpt-4.1` | 使用指定模型 |
| 7.4 | Ask 模式 | 工具调用设 `mode: ask` | 只读，不写文件 |
| 7.5 | **Telegram** | `use Codex to write a hello world Python script` | Bot 调用 codex_agent_direct，文件在工作区生成 |
| 7.6 | **Telegram** | `ask Codex to explain what claw_core does` | Bot 以 ask 模式调用 Codex，返回解释 |

### 8. Skills 验证

| # | 测试项 | 命令 / Telegram | 预期结果 |
|---|--------|----------------|----------|
| 8.1 | Skills 已存在 | `ls ~/.openclaw/skills/ \| wc -l` | 20 个 skills |
| 8.2 | 核心运行时 skill | `cat ~/.openclaw/skills/claw-core-runtime/SKILL.md` | Skill 文件存在 |
| 8.3 | Daemon skill | **Telegram**: `use the claw-core-daemon skill to check status` | Bot 读取 skill，检查 daemon |
| 8.4 | Cron helper | **Telegram**: `schedule a reminder in 30 minutes: take a break` | cron-helper 创建任务 |
| 8.5 | 状态面板 | **Telegram**: `show me the status dashboard` | 返回系统概览 |

### 9. Agent 团队与多 Bot

> **尚未测试。** 需要配置 3 个 Telegram Bot 及群组后再运行此组测试。建议在第 8 节通过后进行。

| # | 测试项 | 命令 / Telegram | 预期结果 |
|---|--------|----------------|----------|
| 9.1 | 配置 Bots | `openclaw clawcore setup-bots` | 3 个 Telegram Bot 配置完成（artist、assistant、developer） |
| 9.2 | 创建团队 | `openclaw clawcore team create my-team` | 团队创建成功 |
| 9.3 | 列出团队 | `openclaw clawcore team list` | 显示团队列表 |
| 9.4 | 配置 Telegram 群组 | `openclaw clawcore team setup-telegram` | 群组配置完成 |
| 9.5 | **Telegram（developer bot）** | `write a Rust function that reverses a string` | Developer Bot 委派给 Cursor，返回代码 |
| 9.6 | **Telegram（assistant bot）** | `what's the weather in Hong Kong?` | Assistant Bot 返回信息 |
| 9.7 | **Telegram（团队群组）** | `coordinate: developer writes the code, assistant reviews it` | team_coordinate 分发任务 |

---

## 参考

| 资源 | 链接 |
|---|---|
| 插件说明 | [plugin/README-zh-Hans.md](plugin/README-zh-Hans.md) |
| Pre-push 测试 | [scripts/pre-push-test.sh](scripts/pre-push-test.sh) |
| 集成验证 | [scripts/verify_integration.sh](scripts/verify_integration.sh) |
| 安装 OpenClaw 插件 | [scripts/install-claw-core-openclaw.sh](scripts/install-claw-core-openclaw.sh) |
| 移除 OpenClaw 插件 | [scripts/remove-claw-core-openclaw.sh](scripts/remove-claw-core-openclaw.sh) |
| 从发布版安装 binary | [scripts/install-from-release.sh](scripts/install-from-release.sh) |

---

## 许可

MIT
