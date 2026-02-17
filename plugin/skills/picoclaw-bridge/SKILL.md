---
name: picoclaw-bridge
description: Bridge to PicoClaw, an ultra-lightweight AI assistant. Use picoclaw_chat for quick questions, web searches, and lightweight tasks.
metadata: {"openclaw":{"requires":{"bins":["picoclaw"]},"emoji":"🐾"}}
---

# PicoClaw Bridge

**PicoClaw** (https://github.com/sipeed/picoclaw) is an ultra-lightweight AI assistant written in Go. It runs on minimal hardware (<10MB RAM, <1s boot) and includes built-in web search, file editing, and shell execution.

## When to Use `picoclaw_chat`

- Quick factual questions: "What is Rust?", "When was Python 3.12 released?"
- Web searches: "Latest React documentation", "Current weather in Tokyo"
- General knowledge that doesn't need code context
- Getting a second opinion from a different AI model
- User explicitly says "ask PicoClaw" or "use PicoClaw"

## When NOT to Use (Use Other Tools Instead)

- Complex coding tasks → use `cursor_agent_direct`
- Design / code-based assets → use `cursor_agent_direct` (Cursor CLI does not support image generation)
- Shell commands → use Claw Core `exec`
- Tasks needing workspace file access → use `cursor_agent_direct` or `read`/`write`

## How to Use

```
picoclaw_chat(message: "What is the latest version of Node.js?")
```

The response comes from PicoClaw's agent, which may use web search, its LLM, or both.

## PicoClaw Capabilities

- **Web search**: built-in search tool for current information
- **Multi-model**: supports OpenRouter, Zhipu, Anthropic, OpenAI, DeepSeek, Groq, Gemini, Ollama
- **Lightweight**: runs on $10 hardware (RISC-V, ARM, x86)
- **Fast**: <1s boot time, efficient responses

## If PicoClaw Is Not Installed

If the tool returns an error about PicoClaw not being found:
1. Inform the user that PicoClaw is not installed
2. Suggest installation: "Install PicoClaw from https://github.com/sipeed/picoclaw"
3. Fall back to answering with your own knowledge

## Cross-Bot Referrals

When acting as the assistant agent:
- Image/design requests → "For design and assets, try @ClawArtistBot! 🎨 (No image generation via Cursor.)"
- Coding/dev tasks → "That's a dev task — @ClawDevBot can help! 🛠️"
