# OpenClaw-related scripts

Scripts here are for **OpenClaw** integration (plugin install/remove, verification, daemon). Separate from general dev and GitHub build scripts.

## Install / Remove / Verify

| Script | Purpose |
|--------|---------|
| [install-claw-core-openclaw.sh](../install-claw-core-openclaw.sh) | Build binary, install plugin, auto-configure `openclaw.json` |
| [remove-claw-core-openclaw.sh](../remove-claw-core-openclaw.sh) | Stop daemon, remove plugin + skills, clean `openclaw.json` |
| [verify_integration.sh](../verify_integration.sh) | Verify claw_core ↔ OpenClaw (config, skills, hooks, runtime) |
| **verify.sh** | Wrapper: runs `../verify_integration.sh` |

### Install

```bash
# First install (copy mode)
./scripts/install-claw-core-openclaw.sh

# Link install (dev — edits apply immediately)
./scripts/install-claw-core-openclaw.sh --link

# Reinstall (removes existing, then installs)
./scripts/install-claw-core-openclaw.sh --force

# Show options
./scripts/install-claw-core-openclaw.sh --help
```

### Remove

```bash
./scripts/remove-claw-core-openclaw.sh
```

### Verify

```bash
./scripts/verify_integration.sh          # normal
./scripts/verify_integration.sh --strict  # treat warnings as failures (CI)
```

## Runtime scripts

| Script | Purpose |
|--------|---------|
| [claw_core_daemon.sh](../claw_core_daemon.sh) | Daemon start/stop used by the OpenClaw plugin |
| [claw_core_shell_wrapper.sh](../claw_core_shell_wrapper.sh) | Shell wrapper so OpenClaw exec goes through claw_core |

Plugin scripts (install skills, etc.) live under **plugin/scripts/**:

- `plugin/scripts/install-skills-to-openclaw.sh` — copy skills to `~/.openclaw/skills/` (e.g. postinstall)

## Skill list

All scripts read the canonical skill list from **[claw-core-skills.list](../claw-core-skills.list)**. If you add or remove skills from the plugin, update that file — install, remove, and verify scripts all source it.
