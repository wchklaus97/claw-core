# 会话生命周期 — 终端 Runtime 层

说明 Runtime 层中终端会话如何被创建、使用与销毁。

## 会话状态

```
                    session.create
                         │
                         ▼
                    ┌──────────┐
                    │ CREATING │  初始化 shell、env、cwd
                    └────┬─────┘
                         │ success
                         ▼
              ┌─────────────────────┐
         ┌───>│        IDLE         │<────────────┐
         │    │   可接收新命令      │              │
         │    └─────────┬───────────┘              │
         │              │ exec.run / exec.stream   │
         │              ▼                          │
         │    ┌──────────────────┐                 │
         │    │     RUNNING      │  命令执行中      │
         │    │  stdout/stderr   │                 │
         │    │  输出持续产生      │                 │
         │    └────────┬─────────┘                 │
         │             │                           │
         │     ┌───────┴────────┐                  │
         │     │                │                  │
         │  exit/timeout    cancel                 │
         │     │                │                  │
         │     ▼                ▼                  │
         │  返回结果          已取消                │
         └────────────────────┴────────────────────┘
                         │
                  session.destroy
                         │
                         ▼
                  ┌──────────────┐
                  │  TERMINATED  │  已清理
                  └──────────────┘
```

## 状态说明

| 状态 | 描述 | 允许操作 |
|-------|-------------|-----------------|
| **CREATING** | Shell 进程正在启动 | 等待（仅内部） |
| **IDLE** | 会话存活，当前无命令运行 | `exec.run`、`exec.stream`、`session.destroy`、`session.info` |
| **RUNNING** | 命令正在执行 | `exec.cancel`、`session.info`、`session.destroy` |
| **TERMINATED** | 会话已结束并清理 | `session.info`（只读） |

## 创建会话

调用 `session.create` 时，Runtime 会：

1. 生成会话 ID（例如 `s-a1b2c3`）
2. 解析 shell（传入值或 `/bin/sh`）
3. 准备环境（Runtime 基础环境 + 会话覆盖）
4. 设置工作目录
5. 启动 shell 进程
6. 注册到会话池
7. 返回会话元数据

### 失败场景

| 失败类型 | 处理方式 |
|---------|----------|
| 未找到 shell 二进制 | 返回错误，不创建会话 |
| 活跃会话过多 | 返回 `MAX_SESSIONS_REACHED` |
| Shell 启动即崩溃 | 返回错误并清理 |

## 会话内命令执行

### 缓冲模式（`exec.run`）

1. Agent 发送 `exec.run`（包含会话 ID 与命令）
2. TRL 检查会话状态为 `IDLE`
3. TRL 将命令写入会话 shell 的 stdin
4. TRL 持续读取 stdout/stderr，直到命令完成（或超时）
5. TRL 记录退出码，会话回到 `IDLE`
6. TRL 返回 `{stdout, stderr, exit_code, duration_ms}`

### 流式模式（`exec.stream`）

1. Agent 发送 `exec.stream`；TRL 返回 `stream_id`
2. TRL 将命令写入 shell stdin
3. 输出到达时，TRL 分块推送给 Agent
4. 命令结束时，TRL 推送最终 `exit` 块；会话回到 `IDLE`

### 超时处理

当触发超时：

1. 向该命令进程组发送 `SIGTERM`
2. 等待 5 秒
3. 若仍存活，发送 `SIGKILL`
4. 返回结果并设置 `timed_out: true`
5. 会话回到 `IDLE`（会话本身不被销毁）

## 销毁会话

调用 `session.destroy` 时：

1. 若有命令运行，先取消（SIGTERM → SIGKILL）
2. 向会话 shell 进程发送 SIGTERM
3. 最多等待 5 秒优雅退出
4. 若 `force: true` 或超出宽限期，则发送 SIGKILL
5. 关闭全部管道并从会话池移除

### 僵尸进程防护

- 使用会自动回收子进程的异步进程处理
- 周期性扫描孤儿 PID
- Runtime 退出时销毁所有活跃会话

## 会话池管理

- **max_sessions**：可配置上限
- **Housekeeping**：周期清理陈旧/空闲/死亡会话
- **Concurrency**：可并行多会话；单会话在缓冲模式下顺序执行
