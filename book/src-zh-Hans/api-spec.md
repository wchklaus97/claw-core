# API 规范 — 终端 Runtime 层

定义代理与 Runtime 层通信所用的协议与端点。

## 传输

| 模式 | 适用场景 | 说明 |
|------|------------|---------|
| **Unix Socket** | 本地、同机 | 默认。快且安全（文件权限）。路径：`/tmp/trl-<instance>.sock` |
| **HTTP** | 远程、Docker、多主机 | 绑定 `127.0.0.1:<port>`。必须启用 Token 认证。 |
| **Stdin/Stdout** | CLI 测试、管道调用 | 一次性模式。从 stdin 读 JSON，向 stdout 写 JSON。 |

## 协议

全部消息均为 **JSON**。每个请求包含 `method` 和可选 `params`。每个响应包含 `ok`（bool）、可选 `data` 与可选 `error`。

### 请求格式

```json
{
  "id": "req-001",
  "method": "session.create",
  "params": {
    "shell": "/bin/zsh",
    "env": {"MY_VAR": "value"},
    "working_dir": "/tmp/sandbox"
  }
}
```

### 响应格式（成功）

```json
{
  "id": "req-001",
  "ok": true,
  "data": {
    "session_id": "s-a1b2c3",
    "created_at": "2026-02-13T12:00:00Z"
  }
}
```

### 响应格式（失败）

```json
{
  "id": "req-001",
  "ok": false,
  "error": {
    "code": "SESSION_NOT_FOUND",
    "message": "No session with id 's-xyz'"
  }
}
```

## 方法

### 会话管理

#### `session.create`

创建一个新的终端会话。

**参数：**

| 字段 | 类型 | 必填 | 默认值 | 描述 |
|-------|------|----------|---------|-------------|
| `shell` | string | 否 | `/bin/sh` | 会话使用的 shell |
| `env` | object | 否 | `{}` | 额外环境变量 |
| `working_dir` | string | 否 | `/tmp` | 初始工作目录 |
| `name` | string | 否 | `null` | 人类可读的会话标签 |
| `timeout_s` | int | 否 | `0`（不限制） | 会话默认命令超时 |

**返回数据：** `session_id`、`shell`、`working_dir`、`state`、`created_at`

---

#### `session.list`

列出所有活跃会话。**参数：** 无。

---

#### `session.info`

获取指定会话详情。**参数：** `session_id`（必填）。

---

#### `session.destroy`

终止并清理会话。**参数：** `session_id`（必填）、`force`（可选 bool）。

---

### 命令执行

#### `exec.run`

在会话中执行命令（缓冲模式），等待命令完成。

**参数：** `session_id`、`command`、`timeout_s`、`stdin`、`env`

**返回数据：** `stdout`、`stderr`、`exit_code`、`duration_ms`、`timed_out`

---

#### `exec.stream`

以实时流输出执行命令。先返回 `stream_id`，然后持续推送输出块。

---

#### `exec.cancel`

取消正在运行的命令。**参数：** `session_id`、`signal`（可选）。

---

### 系统

#### `system.ping`

健康检查。返回：`uptime_s`、`version`。

#### `system.stats`

Runtime 统计：`active_sessions`、`total_commands_run`、`uptime_s`、`memory_rss_bytes`。

---

## 错误码

| Code | 含义 |
|------|---------|
| `SESSION_NOT_FOUND` | 指定 ID 的会话不存在 |
| `SESSION_BUSY` | 会话正在执行命令 |
| `COMMAND_TIMEOUT` | 命令超时 |
| `COMMAND_FAILED` | 命令非零退出 |
| `INVALID_PARAMS` | 参数缺失或格式错误 |
| `INTERNAL_ERROR` | Runtime 内部异常 |
| `AUTH_FAILED` | 认证 Token 无效或缺失 |

---

## 认证（HTTP 模式）

在 HTTP 模式下，请求必须包含：

```
Authorization: Bearer <token>
```

启动 Runtime 时通过环境变量 `TRL_AUTH_TOKEN` 设置 Token。Unix Socket 模式依赖文件系统权限进行访问控制。
