#!/usr/bin/env node
/**
 * Configure openclaw.json for Cursor CLI integration.
 *
 * Adds:
 *   - agents.defaults.cliBackends (cursor-cli, cursor-plan, cursor-ask)
 *   - agents.list with main (subagents.allowAgents: ["*"]) and cursor-dev
 *
 * Skips if openclaw.json does not exist.
 * Safe to run multiple times (idempotent).
 *
 * Usage:
 *   node setup-cursor-integration.js [--workspace /path/to/project]
 *   CURSOR_WORKSPACE=/path node setup-cursor-integration.js
 */

const fs = require('fs');
const path = require('path');
const os = require('os');

const OPENCLAW_CONFIG = path.join(os.homedir(), '.openclaw', 'openclaw.json');

function getWorkspace() {
  // CLI arg: --workspace /path
  const idx = process.argv.indexOf('--workspace');
  if (idx !== -1 && process.argv[idx + 1]) return process.argv[idx + 1];
  // Env var
  if (process.env.CURSOR_WORKSPACE) return process.env.CURSOR_WORKSPACE;
  // Default: ~/.openclaw/workspace
  return path.join(os.homedir(), '.openclaw', 'workspace');
}

/** Detect Cursor CLI: prefer standalone `agent`, fallback to `cursor agent` */
function getCursorCliConfig() {
  const { execSync } = require('child_process');
  try {
    execSync('command -v agent', { stdio: 'ignore' });
    return { command: 'agent', argsAgent: [], argsPlan: ['--mode', 'plan'], argsAsk: ['--mode', 'ask'] };
  } catch {
    try {
      execSync('command -v cursor', { stdio: 'ignore' });
      return {
        command: 'cursor',
        argsAgent: ['agent'],
        argsPlan: ['agent', '--mode', 'plan'],
        argsAsk: ['agent', '--mode', 'ask'],
      };
    } catch {
      return null;
    }
  }
}

function hasCursorCli() {
  return getCursorCliConfig() !== null;
}

function buildCliBackends(workspace) {
  const cli = getCursorCliConfig();
  const cmd = cli ? cli.command : 'cursor';
  const a = cli ? cli.argsAgent : ['agent'];
  const p = cli ? cli.argsPlan : ['agent', '--mode', 'plan'];
  const k = cli ? cli.argsAsk : ['agent', '--mode', 'ask'];
  // stream-json avoids hang that text format causes in headless mode
  const printArgs = ['--print', '--output-format', 'stream-json', '--workspace', workspace];
  return {
    'cursor-cli': {
      command: cmd,
      args: [...a, ...printArgs],
      output: 'text',
      input: 'arg',
      modelArg: '--model',
      serialize: true,
    },
    'cursor-plan': {
      command: cmd,
      args: [...p, ...printArgs],
      output: 'text',
      input: 'arg',
      modelArg: '--model',
      serialize: true,
    },
    'cursor-ask': {
      command: cmd,
      args: [...k, ...printArgs],
      output: 'text',
      input: 'arg',
      modelArg: '--model',
      serialize: true,
    },
  };
}

function main() {
  if (!fs.existsSync(OPENCLAW_CONFIG)) {
    console.log('claw_core: openclaw.json not found, skipping Cursor setup (run: openclaw doctor)');
    return 0;
  }

  const cfg = JSON.parse(fs.readFileSync(OPENCLAW_CONFIG, 'utf8'));
  let changed = false;

  const workspace = getWorkspace();
  const agents = cfg.agents = cfg.agents || {};
  const defaults = agents.defaults = agents.defaults || {};

  // 1. Add or sync cliBackends (use detected command: agent vs cursor)
  const newBackends = buildCliBackends(workspace);
  const currentCmd = defaults.cliBackends?.['cursor-cli']?.command;
  const targetCmd = newBackends['cursor-cli'].command;
  if (!defaults.cliBackends || !defaults.cliBackends['cursor-cli'] || currentCmd !== targetCmd) {
    defaults.cliBackends = Object.assign(defaults.cliBackends || {}, newBackends);
    changed = true;
    console.log('claw_core: ' + (currentCmd ? 'updated' : 'added') + ' cliBackends (cursor-cli, cursor-plan, cursor-ask) using command: ' + targetCmd);
  }

  // 2. Set workspace if not set
  if (!defaults.workspace) {
    defaults.workspace = workspace;
    changed = true;
    console.log('claw_core: set agents.defaults.workspace = ' + workspace);
  }

  // 3. Ensure agents.list exists with main (allowAgents) and cursor-dev
  let list = agents.list || [];
  let mainAgent = list.find((a) => a.id === 'main');
  let cursorAgent = list.find((a) => a.id === 'cursor-dev');

  if (!mainAgent) {
    mainAgent = { id: 'main', default: true, subagents: { allowAgents: ['*'] } };
    list.unshift(mainAgent);
    changed = true;
    console.log('claw_core: added main agent with subagents.allowAgents: ["*"]');
  } else if (!mainAgent.subagents || !mainAgent.subagents.allowAgents) {
    mainAgent.subagents = mainAgent.subagents || {};
    mainAgent.subagents.allowAgents = ['*'];
    changed = true;
    console.log('claw_core: set main agent subagents.allowAgents: ["*"]');
  }

  if (!cursorAgent) {
    cursorAgent = { id: 'cursor-dev', workspace: workspace, model: { primary: 'cursor-cli/auto' } };
    list.push(cursorAgent);
    changed = true;
    console.log('claw_core: added cursor-dev agent (cursor-cli/auto)');
  }

  agents.list = list;

  if (changed) {
    fs.writeFileSync(OPENCLAW_CONFIG, JSON.stringify(cfg, null, 2) + '\n', 'utf8');
    console.log('claw_core: Cursor integration configured in openclaw.json');
    if (!hasCursorCli()) {
      console.log('⚠  Cursor CLI not found in PATH — install Cursor and ensure "agent" or "cursor" is on PATH');
    }
    console.log('Restart the gateway: openclaw gateway restart');
  } else {
    console.log('claw_core: Cursor integration already configured');
  }
  return 0;
}

process.exit(main());
