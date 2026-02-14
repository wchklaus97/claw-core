# 安全与 Token 处理 — 终端 Runtime 层

说明 Runtime 如何处理密钥、认证与隔离边界。

## 核心原则

**密钥只透传，不持久化。**

Runtime 从 Agent 或启动配置接收 token 与环境变量，将其传给子进程，且绝不写入磁盘。

## Token 流

```
┌──────────────────┐     ┌───────────────────┐     ┌──────────────┐
│  Agent / Config  │────>│  Terminal Runtime │────>│ Child Process│
│  TG_BOT_TOKEN=.. │     │  Holds in memory  │     │  Sees in env │
│  CURSOR_API_KEY= │     │  Never writes disk│     │  at runtime  │
└──────────────────┘     └───────────────────┘     └──────────────┘
```

## 环境变量处理

### 注入点

1. **Runtime 启动时**：来自 Runtime 自身环境或 `.env` 文件
2. **创建会话时**：通过 `session.create` 传入会话级变量
3. **执行命令时**：通过 `exec.run` / `exec.stream` 传入命令级变量

### 作用域规则

| 作用域 | 可见性 | 生命周期 |
|-------|-----------|----------|
| Runtime 级 | 所有会话、所有命令 | 直到 Runtime 重启 |
| 会话级 | 该会话中的所有命令 | 直到会话销毁 |
| 命令级 | 仅该次命令 | 直到命令退出 |

### 禁止事项

- **禁止记录环境变量值**：只记录 key，不记录 value
- **禁止将环境变量写盘**：不写临时文件，不导出配置快照
- **禁止在 API 响应中返回密钥**（除非明确需要，且建议脱敏）
- **禁止把密钥硬编码进 Runtime 二进制**

## API 认证

### Unix Socket 模式（默认）

- **机制**：依赖 socket 文件系统权限
- **建议**：socket 权限设为 `0600`（仅所有者可访问）

### HTTP 模式

- **机制**：Bearer Token 认证
- **Token 来源**：环境变量 `TRL_AUTH_TOKEN`
- **每个请求**：`Authorization: Bearer <token>`
- 若启用 HTTP 但未设置 `TRL_AUTH_TOKEN`，Runtime 应**拒绝启动**。

## 隔离边界

### TRL 能隔离什么

| 维度 | 做法 |
|--------|-----|
| **环境变量** | 每个会话独立环境集 |
| **工作目录** | 每个会话独立 cwd |
| **进程树** | 跟踪会话进程，`session.destroy` 可整树清理 |
| **输出** | stdout/stderr 按会话与命令隔离 |

### TRL 当前不能隔离什么（MVP）

| 维度 | 后续方案 |
|--------|------------|
| **文件系统** | L2：chroot 或 Docker |
| **网络** | L2：network namespaces |
| **资源** | L2：cgroups；见 [资源控制](resource-control.md) |
| **用户** | L2：按会话切换用户 |

## 威胁模型（面向 Agent 开发者）

| 威胁 | 缓解方式 |
|--------|-----------|
| Agent 发送恶意命令 | TRL 不做命令语义判断；安全策略由 Agent 负责。TRL 提供超时与终止机制。 |
| 输出中泄露密钥 | Agent 应在展示给用户前做脱敏。 |
| 未授权 API 访问 | 本地靠 socket 权限，HTTP 靠 bearer token。配置错误时应默认安全失败。 |
| 会话劫持 | Session ID 使用随机 UUID，避免可枚举。 |
| 崩溃后僵尸进程 | 周期回收；启动时清理孤儿进程。 |
| 资源耗尽 | 会话上限、命令超时、setrlimit；见 [资源控制](resource-control.md)。 |

## 部署安全检查清单

- [x] Runtime 以**非 root** 用户运行
- [ ] `.env` 权限为 `0600`
- [x] Unix Socket 权限为 `0600`
- [ ] 启用 HTTP 时已设置 `TRL_AUTH_TOKEN`
- [ ] 日志中不包含环境变量值
- [x] 已配置最大会话数
- [x] 已设置默认超时
- [ ] Runtime 二进制不可被所有用户写入
