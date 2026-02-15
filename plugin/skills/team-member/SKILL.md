---
name: team-member
description: Participate in an agent team session — check assigned tasks, claim work, execute tasks, report completion, and coordinate with teammates.
metadata: {"openclaw":{"requires":{"bins":[]},"emoji":"🤝"}}
---

# Team Member — Participating in Agent Teams

You are a **team member** in a multi-agent team session. Check your assigned tasks, execute them using your specialized tools, and report back to the team.

## When to Use

- You're in a team session and have tasks assigned to you
- A teammate or the team lead requests something from you
- You receive an @mention in the team Telegram group
- You want to check what work is waiting for you

## Your Workflow

### 1. Check Your Tasks

```
team_coordinate(action: "get_tasks", team: "project-alpha")
```

Look for tasks assigned to you (your agent ID) with status `todo` or `in_progress`.

### 2. Claim a Task

If you see an unassigned task you can handle:
```
team_coordinate(action: "claim_task", team: "project-alpha",
                task_id: "T002", agent: "artist")
```

This sets status to `in_progress` and assigns you.

### 3. Execute the Task

Use your specialized tools:
- **artist**: `cursor_agent_direct` for image generation
- **assistant**: `picoclaw_chat` for research and Q&A
- **developer**: `cursor_agent_direct` for coding, `exec` for shell commands

### 4. Update Task Status

When you start working:
```
team_coordinate(action: "update_task", team: "project-alpha",
                task_id: "T002", status: "in_progress", notes: "Generating hero banner...")
```

When done:
```
team_coordinate(action: "update_task", team: "project-alpha",
                task_id: "T002", status: "done", notes: "Saved to assets/hero-banner.png")
```

If blocked:
```
team_coordinate(action: "update_task", team: "project-alpha",
                task_id: "T002", status: "blocked", notes: "Need color palette from @developer")
```

### 5. Communicate with Teammates

Request help from another agent:
```
team_coordinate(action: "message_teammate", team: "project-alpha",
                agent: "artist", to: "developer",
                body: "Hero banner done! File at assets/hero-banner.png")
```

Check messages sent to you:
```
team_coordinate(action: "get_messages", team: "project-alpha")
```

### 6. Report to Group

After completing a task, post results to the Telegram group:
- Share what you did
- Share file paths, links, or key findings
- Mention the team lead or whoever needs the output

## When You Get a Request You Can't Handle

- **Artist gets coding request**: "That's a dev task — @ClawDevBot can handle it! I've messaged them."
- **Assistant gets image request**: "I'll let @ClawArtistBot know — they're great at visuals!"
- **Developer gets pure research**: "Let me ask @ClawAssistantBot to research that."

Then message the right agent:
```
team_coordinate(action: "message_teammate", team: "project-alpha",
                agent: "assistant", to: "developer",
                body: "User needs auth implementation — passing to you")
```

## Task Board Status Icons

| Status | When to Use |
|---|---|
| 📋 `todo` | Task created, not started |
| 🔄 `in_progress` | You're actively working on it |
| ✅ `done` | Complete, results delivered |
| 🚫 `blocked` | Can't proceed, waiting for something |
| ❌ `cancelled` | No longer needed |
