# Claw Core（简体中文）

[![Rust](https://img.shields.io/badge/Rust-stable-orange?logo=rust)](https://www.rust-lang.org/)
![Version](https://img.shields.io/badge/version-0.1.0-blue)
[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)

![Claw Core 横幅](assets/images/claw-core-hero-banner.jpeg)

Agent CLI 执行运行时：稳定、可控、可观测的命令执行核心。

完全支持 OpenClaw，并提供用于 OpenClaw 工作流的 Cursor 插件集成（`plugin/`）。测试版本：OpenClaw 2026.2.13、Cursor IDE 2.5.11，详见 [插件说明](plugin/README-zh-Hans.md#兼容性)。

实验性 ZeroClaw 支持：通过 [`claw-core-protocol`](crates/claw-core-protocol/) Rust crate 提供（尚未测试）。

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

- **失控进程**：命令/会话超时与清理
- **会话混乱**：明确会话生命周期与隔离边界
- **结果不统一**：标准化 JSON 响应
- **可观测性差**：运行时统计与健康检查
- **密钥风险**：环境变量透传，不落盘
- **OpenClaw 对接复杂**：通过 Cursor 插件直接接入 OpenClaw 真实工作流

---

## How（如何工作）

1. 代理发送 JSON 请求（`system.ping`、`session.*`、`exec.run`、`system.stats`）
2. Claw Core 校验并分发到对应模块
3. 执行器按超时策略执行并采集输出
4. 返回结构化响应给调用方

---

## 快速开始

### 前置依赖

- Rust stable
- `socat`（本地 socket 探测）

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

工作流：`.github/workflows/release.yml`

触发条件：

- 推送 `v*` 标签（例如 `v0.1.0`）

产物平台：

- Linux `x86_64` / `aarch64`
- macOS `x86_64` / `aarch64`

**说明：** 暂不支持 Windows（claw_core 使用 Unix domain socket、rlimit 等 Unix 专属 API）。

---

## 版本策略

- 当前版本：`0.1.0`
- 发布以 git tag `v*` 为准

推荐流程：

1. 更新 `Cargo.toml` 版本
2. 提交代码
3. 打并推送标签：`git tag v0.1.0 && git push origin v0.1.0`
4. 自动产出发布包

---

## ZeroClaw 支持（实验性，尚未测试）

[ZeroClaw](https://github.com/ArcadeLabsInc/zeroclaw) 是一个全 Rust AI 代理运行时。OpenClaw 插件（npm）无法在 ZeroClaw 中运行，但 `claw_core` 守护进程协议（Unix socket 上的 JSON）与运行时无关。

我们提供了一个独立的 Rust crate — [`claw-core-protocol`](crates/claw-core-protocol/) — 为 ZeroClaw 提供类型化的异步客户端：

```bash
# ZeroClaw 通过功能标志集成
cargo install zeroclaw --features claw-core
```

当 `claw-core` 功能启用且 ZeroClaw 配置中 `claw_core.enabled = true` 时，会注册 `ClawCoreExecTool`，连接到与 OpenClaw 插件相同的守护进程 socket。

> **状态：** `claw-core-protocol` crate 可编译，架构已就绪，但尚未进行与 ZeroClaw + claw_core 守护进程的端到端测试。

详情请参阅 [`crates/claw-core-protocol/README.md`](crates/claw-core-protocol/README.md)。

---

## 项目结构（Core）

```text
claw/
├── src/                   # runtime 实现
├── tests/                 # 单元/集成测试
├── scripts/               # smoke 与辅助脚本
├── plugin/                # 用于 OpenClaw 的 Cursor 插件集成
├── crates/
│   └── claw-core-protocol/  # ZeroClaw / 通用守护进程客户端 Rust crate
├── .github/workflows/     # CI 与发布流程
├── README.md
├── README-zh-Hans.md
└── README-zh-Hant.md
```

---

## 参考

- [插件说明](plugin/README-zh-Hans.md)
- [claw-core-protocol crate](crates/claw-core-protocol/README.md)
- [Pre-push 测试](scripts/pre-push-test.sh)
- [集成验证](scripts/verify_integration.sh)
- [安装脚本](scripts/install-from-release.sh)
