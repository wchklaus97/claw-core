---
name: team-telegram-group
description: Best practices for multi-agent collaboration in Telegram group chats — @mentions, forum topics, group vs DM, and team communication patterns.
metadata: {"openclaw":{"requires":{"bins":[]},"emoji":"📢"}}
---

# Team Telegram Group — Communication Patterns

Best practices for multi-agent collaboration in Telegram group chats. Apply when participating in a team session via Telegram.

## Group Chat Structure

### Without Forum Topics (Simple Group)
All agents and humans share one thread. Use @mentions to direct messages:
```
@ClawArtistBot generate a logo for our startup
@ClawAssistantBot what are the best Go frameworks?
@ClawDevBot implement the auth module
```

### With Forum Topics (Recommended)
Each topic routes to a primary agent:

| Topic | Primary Agent | Purpose |
|---|---|---|
| 📋 General | All (broadcast) | Coordination, status updates |
| 🎨 Design | artist | Visual tasks, images, mockups |
| 💬 Research | assistant | Questions, web search, analysis |
| 🛠️ Code | developer | Coding, builds, deployment |

Post in the relevant topic for best results. All agents can still see all topics via the broadcast group.

## @Mention Rules

### When to @Mention Another Agent
- You need something from them: "@ClawArtistBot I need a hero image"
- Handing off a task: "@ClawDevBot the design is ready, here's the file"
- Requesting input: "@ClawAssistantBot what's the best approach for X?"

### When NOT to @Mention
- When responding to a message already directed at you
- When posting a status update (just post to the general topic)
- When the group is in broadcast mode and all agents see everything

## Group vs DM

### Use the Group For:
- Status updates and announcements
- Task assignments and handoffs
- Results that everyone needs to see
- Cross-agent requests
- Quick coordination

### Use DMs For:
- Detailed 1-on-1 work with an agent
- Sensitive information
- Long conversations that would clutter the group
- Personal preferences/settings

## Communication Patterns

### Pattern 1: Task Assignment (Lead → Member)
```
Lead:    "Breaking this down into tasks:
          📋 T001: Hero image → @ClawArtistBot
          📋 T002: API research → @ClawAssistantBot
          📋 T003: Implementation → me"
Artist:  "🔄 T001 claimed, working on it..."
Artist:  "✅ T001 done! assets/hero.png [preview]"
```

### Pattern 2: Cross-Agent Request
```
Developer: "@ClawArtistBot need a loading spinner icon, 64x64, white on transparent"
Artist:    "🎨 Done! assets/spinner.png"
Developer: "Thanks, integrated into the UI ✅"
```

### Pattern 3: Research → Implementation
```
Developer: "@ClawAssistantBot what's the best JWT library for Rust?"
Assistant: "Top 3: jsonwebtoken (most popular), jwt-simple, paseto.
            jsonwebtoken has 2M downloads/month. Want details?"
Developer: "Using jsonwebtoken. @ClawAssistantBot any security gotchas?"
Assistant: "Key points: always validate exp, use RS256 over HS256 for production..."
```

### Pattern 4: Status Update
```
Developer: "📊 Team Status Update:
            ✅ Auth module — done
            ✅ Hero image — done (@ClawArtistBot)
            🔄 Landing page — 80% done
            📋 Mobile responsive — up next
            
            ETA: 2 more hours for completion."
```

### Pattern 5: Blocker Escalation
```
Artist:    "🚫 T004 blocked — need the brand colors from the human"
Developer: "Noted. @Human any preference on brand colors?"
Human:     "Blue (#2563EB) and white"
Developer: "@ClawArtistBot brand colors: Blue #2563EB + White"
Artist:    "🔄 Unblocked! Working on it..."
```

## Response Formatting in Groups

- **Keep it concise** — groups are noisy, be brief
- **Use emoji status** — ✅ 🔄 📋 🚫 for quick scanning
- **Include file paths** — when sharing generated files
- **Tag relevant agents** — so they see the message
- **Summarize, don't dump** — for long output, summarize and offer details

## Human Authority

- **Humans are the ultimate authority** — always prioritize human messages
- **Ask before proceeding** on ambiguous or high-impact tasks
- **Respect human overrides** — if a human contradicts the team lead, follow the human
- **Report to humans** — post regular status updates visible to all group members
