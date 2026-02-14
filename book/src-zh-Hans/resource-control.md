# CPU 与内存控制 — 保持服务层存活

用于限制 CPU 与内存占用，确保失控会话或命令**不会**拖垮整个 Runtime。

## 目标

- **子进程**（会话中执行的命令）不能耗尽主机 CPU 或内存
- **Runtime 进程**（Rust 守护进程）必须保持在可控边界内
- **失败策略**：命中限制时，只拒绝或终止问题单元（某个会话/某条命令），而不是整服务崩溃

## 1. 应用层控制（全平台）

### 1.1 会话与并发限制

| 控制项 | 目的 | 示例 |
|--------|---------|---------|
| **最大会话数** | 限制会话总量 | `max_sessions: 64` |
| **最大并发命令数** | 限制同一时刻命令量 | 每会话 1 条或全局 16 条 |
| **会话空闲超时** | 销毁长期空闲会话 | `max_idle_sec: 3600` |
| **每客户端最大会话数** | 可选限制 | 例如每客户端 8 个 |

### 1.2 单命令限制

| 控制项 | 目的 | 示例 |
|--------|---------|---------|
| **命令超时** | 停止长时间命令 | 每次 `exec.run` 传 `timeout_s: 300` |
| **默认超时** | 兜底超时 | 例如 60 秒 |
| **输出缓冲上限** | 限制 stdout/stderr 体积 | 例如每路 4 MiB |
| **stdin 大小上限** | 限制输入大小 | 例如 1 MiB |

### 1.3 背压与拒绝

- 当 `active_sessions >= max_sessions` 时，**拒绝新会话**
- 当会话忙碌时，**拒绝新命令**（返回 `SESSION_BUSY`）
- **可选**：对每客户端 API 请求做速率限制

### 1.4 Runtime 自监控

- **周期回收**：僵尸子进程、死亡会话
- **健康端点**：`system.ping` / `system.stats`
- **优雅停机**：收到 SIGTERM 后停止接新请求，排空或终止命令，再销毁会话

## 2. 子进程资源限制（Unix）

在子进程执行前使用 **setrlimit**。Rust 中可用 `Command::unsafe_pre_exec`。

| 资源 | 常量 | 效果 |
|----------|----------|--------|
| **CPU 时间（秒）** | `RLIMIT_CPU` | CPU 时间超限后进程会被杀死 |
| **虚拟地址空间（字节）** | `RLIMIT_AS` | 限制虚拟内存 |
| **进程数** | `RLIMIT_NPROC` | 防止命令 fork 炸弹 |
| **打开文件数** | `RLIMIT_NOFILE` | 防止文件描述符耗尽 |

**Rust crate：** `rlimit`（docs.rs/rlimit），仅 Unix。

**配置建议：** 参数化限制（如 `limit_cpu_sec`、`limit_memory_bytes`、`limit_nproc`）。

## 3. Cgroups（Linux）— 更强隔离

若需要**严格**的会话级 CPU 与内存限制，使用 cgroups 由内核强制执行。

| 目标 | 机制 |
|------|------------|
| **会话级内存上限** | cgroup v2 `memory.max` |
| **会话级 CPU 上限** | cgroup v2 `cpu.max`（quota + period） |
| **作用范围** | 每个会话一个 cgroup；shell 及其子进程都加入该组 |

**Rust crate：** `cgroups-rs`（kata-containers/cgroups-rs）。

## 4. 实施顺序总结

| 层 | MVP（先上线） | 下一步（L2） |
|-------|------------------|-----------|
| **应用层** | 最大会话数、命令超时、输出缓冲上限、容量拒绝、优雅停机 | 会话空闲超时、每客户端限制、速率限制 |
| **子进程层** | 在 `pre_exec` 设置 `RLIMIT_CPU`、`RLIMIT_AS`、`RLIMIT_NPROC`（可配置） | 按环境微调参数 |
| **Linux 隔离层** | — | 每会话 cgroups（`memory.max`、`cpu.max`） |
| **内存层** | 限制索引大小或批大小 | 查询限速与监控 |

**原则：** 先做**应用层 + setrlimit**（macOS/Linux 都可用、无需 root），需要更强隔离再上 Linux **cgroups**。

## 5. 防止服务层崩溃检查清单

- [x] 已配置 **max_sessions**，超限时拒绝
- [x] 已强制 **命令超时**（默认值 + 每请求覆盖）
- [x] 已限制 **输出缓冲**（stdout/stderr）
- [x] 每个子进程在 **pre_exec** 设置 **RLIMIT_CPU**、**RLIMIT_AS**（可选 NPROC）
- [x] 支持 SIGTERM 下的 **优雅停机**
- [x] 有僵尸与死亡会话的 **周期回收**
- [ ] （L2）Linux 每会话启用 **cgroups** 做硬性 CPU/内存限制
