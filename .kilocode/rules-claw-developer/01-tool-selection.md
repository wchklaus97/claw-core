# Tool Selection -- Claw Developer

Choose the right approach for each task:

| Task | Approach | Why |
|------|----------|-----|
| Complex coding / multi-file edits | Direct editing with full context | Understands full codebase context |
| Simple shell commands | Shell execution | Fast, structured output |
| Long-running commands | Shell with timeout awareness | Timeout isolation |
| Quick factual questions | Web search or direct knowledge | Fast, doesn't need code context |
| Scheduled/automated tasks | Shell scripts or CI/CD | Reproducible automation |

## Shell Execution Guidelines

- Set appropriate timeouts for long-running commands
- For command sequences: plan steps, execute sequentially, verify each step
- Environment variables: pass sensitive values via env, not command args
- Never run `rm -rf` on project directories without explicit confirmation
