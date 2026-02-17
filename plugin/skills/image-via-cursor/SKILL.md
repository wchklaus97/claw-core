---
name: image-via-cursor
description: Generate images via Cursor Agent's built-in image generation (auto model). Use when the user asks to create, draw, design, or generate any visual content.
metadata: {"openclaw":{"requires":{"bins":["cursor"]},"emoji":"🎨"}}
---

# Image Generation via Cursor Agent

**Cursor 2.4+** has built-in image generation using auto model selection. No third-party API keys needed. Use the `cursor_agent_direct` tool to generate images.

## When to Use

- User says: "generate image", "create picture", "draw", "imagine", "design"
- User asks for: logos, mockups, icons, illustrations, diagrams, UI designs
- User says: "make me a picture of...", "visualize...", "show me what ... looks like"
- User uploads a reference image and asks for modifications or similar images

## How to Generate

Use the `cursor_agent_direct` tool with a detailed visual prompt:

```
cursor_agent_direct(prompt: "Generate an image of: [detailed description]")
```

### Prompt Tips

Be specific for best results:

- **Style**: "watercolor", "flat design", "3D render", "pixel art", "photorealistic", "minimalist vector"
- **Mood**: "warm", "dramatic", "playful", "dark", "serene", "vibrant"
- **Composition**: "close-up", "wide angle", "centered", "isometric", "bird's eye view"
- **Colors**: specific palette ("blue and gold") or general ("earth tones", "neon")
- **Context**: describe the scene, background, lighting

### Examples

| User Request | Enhanced Prompt |
|---|---|
| "draw a cat" | "Generate an image of a fluffy orange tabby cat sitting on a windowsill, warm afternoon sunlight, cozy watercolor style" |
| "make a logo" | "Generate a minimalist vector logo for a tech company called 'Claw', featuring a stylized crab claw icon, blue and silver palette, clean modern design on white background" |
| "UI mockup" | "Generate a mobile app UI mockup for a task manager, dark mode, minimal design, showing a list view with checkboxes, iOS style, high fidelity" |

## Output

- Generated images are automatically moved to `$WORKSPACE/generated/images/`
  - **Main agent (cursor-dev)**: `~/Documents/claw_core/generated/images/` (or custom `defaultWorkspace`)
  - **Telegram bots**: `~/.openclaw/workspace-{bot_id}/generated/images/`
  - **Custom agents**: Agent-specific workspace + `/generated/images/`
- The tool response includes file paths of created images in `files_created`
- Images are automatically organized and tracked for platform routing
- Share the file path and describe what was generated

> **Note**: `$WORKSPACE` is dynamically resolved based on the agent's configured workspace. Skills should never hardcode absolute workspace paths.

## Platform-Aware Response

The response (including generated images) is automatically routed back to the **platform the request came from**:

- **Telegram** → image is sent as a photo/document reply to the user's chat
- **Webhook** → image path is included in the JSON response payload
- **Gateway RPC** → file paths returned in the `files_created` field

You do NOT need to handle routing manually. OpenClaw's gateway tracks the originating channel (`_channel`, `_accountId`) and routes the response — including any file attachments — back to the same platform. Just include the file paths in your response and the gateway handles delivery.

## After Generation

- Ask: "Want me to try a different style or make variations?"
- Suggest alternatives: "I could also try this as a 3D render / flat design / etc."
- If the user wants edits: adjust the prompt and regenerate
