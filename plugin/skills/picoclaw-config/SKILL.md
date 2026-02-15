---
name: picoclaw-config
description: View and manage PicoClaw configuration (model, provider, language). Use when user asks to switch models, check config, or change PicoClaw settings.
metadata: {"openclaw":{"requires":{"bins":["picoclaw"]},"emoji":"⚙️"}}
---

# PicoClaw Configuration Management

Manage PicoClaw's configuration from the agent using the `picoclaw_config` tool.

## When to Use

- "Show PicoClaw config" / "What model is PicoClaw using?"
- "Switch PicoClaw to deepseek-chat" / "Change PicoClaw model"
- "Set PicoClaw language to Chinese" / "Use a different provider"
- "What providers does PicoClaw support?"

## How to Use

### View Current Config

```
picoclaw_config(action: "view")
```

Returns current settings (model, base_url, language, etc.). API keys are redacted.

### Update a Config Field

```
picoclaw_config(action: "set", key: "model", value: "deepseek-chat")
picoclaw_config(action: "set", key: "language", value: "zh")
picoclaw_config(action: "set", key: "temperature", value: "0.5")
```

## Available Config Fields

| Field | Description | Example Values |
|---|---|---|
| `model` | LLM model name | `deepseek-chat`, `glm-4`, `gpt-4o`, `claude-3-sonnet` |
| `base_url` | API endpoint URL | `https://api.deepseek.com`, `https://openrouter.ai/api/v1` |
| `api_key` | API key (handle carefully!) | `sk-...` |
| `language` | Response language | `en`, `zh`, `ja` |
| `temperature` | Creativity (0.0–1.0) | `0.7` (default) |
| `max_tokens` | Token limit | `8192` (default) |
| `max_tool_iterations` | Tool usage limit | `20` (default) |

## Supported Providers

| Provider | Base URL | Popular Models |
|---|---|---|
| DeepSeek | `https://api.deepseek.com` | `deepseek-chat`, `deepseek-coder` |
| OpenAI | `https://api.openai.com/v1` | `gpt-4o`, `gpt-4o-mini` |
| Anthropic | `https://api.anthropic.com/v1` | `claude-3-sonnet`, `claude-3-haiku` |
| OpenRouter | `https://openrouter.ai/api/v1` | Various (meta-llama, mistral, etc.) |
| Zhipu | `https://open.bigmodel.cn/api/paas/v4` | `glm-4`, `glm-4-flash` |
| Groq | `https://api.groq.com/openai/v1` | `llama-3.1-70b`, `mixtral-8x7b` |
| Ollama | `http://localhost:11434/v1` | Local models |
| Gemini | `https://generativelanguage.googleapis.com/v1beta` | `gemini-pro`, `gemini-1.5-flash` |

## Config File Location

PicoClaw stores config at `~/.picoclaw/workspace/config.json` (or `~/.picoclaw/config.json`).

## Safety

- Never display full API keys — they are automatically redacted when viewing config
- When setting `api_key`, confirm with the user before writing
- Warn users about switching to expensive models (e.g., GPT-4o, Claude-3-Opus)
