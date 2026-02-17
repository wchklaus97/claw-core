#!/usr/bin/env node
/**
 * Teardown claw-core from openclaw.json and remove installed skills.
 * Run BEFORE removing the plugin directory. Safe to run multiple times.
 *
 * Usage:
 *   node teardown-openclaw-config.cjs
 *   PLUGIN_ROOT=/path node teardown-openclaw-config.cjs
 *
 * Typically run as:
 *   openclaw clawcore stop && node $PLUGIN_ROOT/scripts/teardown-openclaw-config.cjs
 */

const fs = require('fs');
const path = require('path');
const os = require('os');

const PLUGIN_ROOT = process.env.PLUGIN_ROOT || process.env.CLAW_CORE_PLUGIN_ROOT
  || path.join(os.homedir(), '.openclaw', 'extensions', 'claw-core');
const OPENCLAW_CONFIG = path.join(os.homedir(), '.openclaw', 'openclaw.json');
const SKILLS_DIR = path.join(os.homedir(), '.openclaw', 'skills');

function getSkillNames() {
  const skillsPath = path.join(PLUGIN_ROOT, 'skills');
  if (!fs.existsSync(skillsPath)) return [];
  return fs.readdirSync(skillsPath)
    .filter((name) => {
      const full = path.join(skillsPath, name);
      return fs.statSync(full).isDirectory() && fs.existsSync(path.join(full, 'SKILL.md'));
    });
}

function main() {
  if (!fs.existsSync(OPENCLAW_CONFIG)) {
    console.log('claw_core: openclaw.json not found — nothing to clean.');
    return 0;
  }

  const cfg = JSON.parse(fs.readFileSync(OPENCLAW_CONFIG, 'utf8'));
  let changed = false;
  const skillNames = getSkillNames();

  // --- Remove plugins.entries.claw-core ---
  const entries = cfg.plugins?.entries || {};
  if ('claw-core' in entries) {
    delete entries['claw-core'];
    changed = true;
    console.log('   ✓ Removed plugins.entries.claw-core');
  }

  // --- Remove plugins.installs.claw-core ---
  const installs = cfg.plugins?.installs || {};
  if ('claw-core' in installs) {
    delete installs['claw-core'];
    changed = true;
    console.log('   ✓ Removed plugins.installs.claw-core');
  }

  // --- Remove load.paths pointing to this plugin ---
  const loadPaths = cfg.plugins?.load?.paths || [];
  const pluginNorm = path.resolve(PLUGIN_ROOT);
  const cleaned = loadPaths.filter((p) => path.resolve(p) !== pluginNorm);
  if (cleaned.length !== loadPaths.length) {
    if (cleaned.length) {
      cfg.plugins.load.paths = cleaned;
    } else {
      delete cfg.plugins.load.paths;
      if (Object.keys(cfg.plugins.load).length === 0) delete cfg.plugins.load;
    }
    changed = true;
    console.log('   ✓ Removed load path');
  }

  // --- Remove skill entries ---
  const skillEntries = cfg.skills?.entries || {};
  for (const name of skillNames) {
    if (name in skillEntries) {
      delete skillEntries[name];
      changed = true;
    }
  }
  if (changed && skillNames.length) console.log('   ✓ Removed skill entries from config');

  // --- Remove Cursor integration ---
  const agents = cfg.agents || {};
  const defaults = agents.defaults || {};
  const cliBackends = defaults.cliBackends;
  if (cliBackends) {
    for (const name of ['cursor-cli', 'cursor-plan', 'cursor-ask']) {
      if (name in cliBackends) {
        delete cliBackends[name];
        changed = true;
        console.log('   ✓ Removed agents.defaults.cliBackends.' + name);
      }
    }
    if (Object.keys(cliBackends).length === 0) {
      delete defaults.cliBackends;
      changed = true;
    }
  }
  const agentList = agents.list || [];
  const newList = agentList.filter((a) => a.id !== 'cursor-dev');
  if (newList.length !== agentList.length) {
    cfg.agents.list = newList;
    changed = true;
    console.log('   ✓ Removed cursor-dev agent');
  }

  if (changed) {
    fs.writeFileSync(OPENCLAW_CONFIG, JSON.stringify(cfg, null, 2) + '\n', 'utf8');
    console.log('   ✓ openclaw.json updated');
  }

  // --- Remove skill directories ---
  if (fs.existsSync(SKILLS_DIR)) {
    for (const name of skillNames) {
      const skillPath = path.join(SKILLS_DIR, name);
      if (fs.existsSync(skillPath)) {
        fs.rmSync(skillPath, { recursive: true });
        console.log('   ✓ Removed skill: ' + name);
      }
    }
  }

  console.log('claw_core: teardown complete. Remove plugin dir: rm -rf ' + PLUGIN_ROOT);
  return 0;
}

process.exit(main());
