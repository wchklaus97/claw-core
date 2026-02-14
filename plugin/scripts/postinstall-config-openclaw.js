#!/usr/bin/env node
/**
 * Configure openclaw.json for claw-core plugin (one-command install).
 * Sets binaryPath to plugin/bin/claw_core and enables skill entries.
 * Skips if openclaw.json does not exist.
 */

const fs = require('fs');
const path = require('path');
const os = require('os');

const PLUGIN_ROOT = path.resolve(__dirname, '..');
const OPENCLAW_CONFIG = path.join(os.homedir(), '.openclaw', 'openclaw.json');
const PLUGIN_JSON = path.join(PLUGIN_ROOT, 'openclaw.plugin.json');

function getBinaryPath() {
  const isWin = process.platform === 'win32';
  const bin = path.join(PLUGIN_ROOT, 'bin', isWin ? 'claw_core.exe' : 'claw_core');
  return bin;
}

function getSkillNames() {
  if (!fs.existsSync(PLUGIN_JSON)) return [];
  const pj = JSON.parse(fs.readFileSync(PLUGIN_JSON, 'utf8'));
  const skills = pj.skills || [];
  return skills.map((s) => {
    const m = s.match(/[/\\]?([^/\\]+)$/);
    return m ? m[1] : s;
  });
}

function main() {
  if (!fs.existsSync(OPENCLAW_CONFIG)) {
    console.log('claw_core: openclaw.json not found, skipping config (run: openclaw doctor)');
    return 0;
  }

  const cfg = JSON.parse(fs.readFileSync(OPENCLAW_CONFIG, 'utf8'));
  let changed = false;

  // Ensure plugins.entries["claw-core"]
  const entries = cfg.plugins = cfg.plugins || {};
  const pluginEntries = entries.entries = entries.entries || {};
  let claw = pluginEntries['claw-core'] = pluginEntries['claw-core'] || {};
  claw.enabled = true;
  claw.config = claw.config || {};

  const binaryPath = getBinaryPath();
  if (claw.config.binaryPath !== binaryPath) {
    claw.config.binaryPath = binaryPath;
    changed = true;
  }
  if (claw.config.autoStart !== true) {
    claw.config.autoStart = true;
    changed = true;
  }

  // Skill entries
  const skillNames = getSkillNames();
  const skillEntries = cfg.skills = cfg.skills || {};
  const se = skillEntries.entries = skillEntries.entries || {};
  for (const name of skillNames) {
    if (!se[name] || !se[name].enabled) {
      se[name] = { enabled: true };
      changed = true;
    }
  }

  if (changed) {
    fs.writeFileSync(OPENCLAW_CONFIG, JSON.stringify(cfg, null, 2) + '\n', 'utf8');
    console.log('claw_core: openclaw.json configured (binaryPath, skills)');
  } else {
    console.log('claw_core: openclaw.json already configured');
  }
  return 0;
}

process.exit(main());
