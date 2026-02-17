#!/usr/bin/env node
/**
 * Initialize or reset the claw_core workspace.
 *
 * Actions:
 *   init   — Create workspace + shared dirs + templates + default skills
 *   reset  — Back up shared_memory, then recreate workspace from scratch
 *
 * Usage:
 *   node init-workspace.js init  [--workspace /path]
 *   node init-workspace.js reset [--workspace /path]
 *   CURSOR_WORKSPACE=/path node init-workspace.js init
 */

const fs = require('fs');
const path = require('path');
const os = require('os');
const { execSync } = require('child_process');

const DEFAULT_WORKSPACE = path.join(os.homedir(), 'Documents', 'claw_core');
const PLUGIN_ROOT = path.join(__dirname, '..');
const TEMPLATES_DIR = path.join(PLUGIN_ROOT, 'templates');

function getWorkspace() {
  const idx = process.argv.indexOf('--workspace');
  if (idx !== -1 && process.argv[idx + 1]) return process.argv[idx + 1];
  if (process.env.CURSOR_WORKSPACE) return process.env.CURSOR_WORKSPACE;
  return DEFAULT_WORKSPACE;
}

function getAction() {
  const args = process.argv.slice(2).filter(a => !a.startsWith('--'));
  return args[0] || 'init';
}

const WORKSPACE_DIRS = ['', 'shared_memory', 'shared_skills', 'projects', 'generated', 'generated/images', 'generated/exports'];
const TEMPLATE_FILES = [
  { src: 'WORKSPACE.md', dest: 'WORKSPACE.md' },
  { src: '.gitignore', dest: '.gitignore' },
];

function ensureDir(dir) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
    console.log('  created: ' + dir);
    return true;
  }
  return false;
}

function copyTemplate(srcName, destPath) {
  const src = path.join(TEMPLATES_DIR, srcName);
  if (!fs.existsSync(destPath) && fs.existsSync(src)) {
    fs.copyFileSync(src, destPath);
    console.log('  created: ' + destPath);
    return true;
  }
  return false;
}

/**
 * Recursively copy a directory (shallow: files + one level of subdirs).
 */
function copyDirRecursive(src, dest) {
  if (!fs.existsSync(src)) return false;
  ensureDir(dest);
  const entries = fs.readdirSync(src, { withFileTypes: true });
  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);
    if (entry.isDirectory()) {
      copyDirRecursive(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
  return true;
}

/**
 * Find the superpowers skills directory.
 * Checks: CLAW_ROOT/.cursor/superpowers/skills, PLUGIN_ROOT/../.cursor/superpowers/skills
 */
function findSuperpowersLocal() {
  const candidates = [
    process.env.CLAW_ROOT && path.join(process.env.CLAW_ROOT, '.cursor', 'superpowers', 'skills'),
    path.join(PLUGIN_ROOT, '..', '.cursor', 'superpowers', 'skills'),
    path.join(os.homedir(), 'Desktop', 'claw', '.cursor', 'superpowers', 'skills'),
  ].filter(Boolean);
  for (const p of candidates) {
    if (fs.existsSync(p)) return p;
  }
  return null;
}

/**
 * Clone superpowers skills from GitHub if not available locally.
 */
function fetchSuperpowersFromGithub(destDir) {
  const tmpDir = path.join(os.tmpdir(), 'superpowers-clone-' + Date.now());
  try {
    console.log('  fetching superpowers from github.com/obra/superpowers...');
    execSync('git clone --depth 1 https://github.com/obra/superpowers.git ' + JSON.stringify(tmpDir), { stdio: 'pipe' });
    const skillsDir = path.join(tmpDir, 'skills');
    if (fs.existsSync(skillsDir)) {
      const skills = fs.readdirSync(skillsDir, { withFileTypes: true }).filter(d => d.isDirectory());
      for (const skill of skills) {
        const src = path.join(skillsDir, skill.name);
        const dest = path.join(destDir, skill.name);
        if (!fs.existsSync(dest)) {
          copyDirRecursive(src, dest);
          console.log('  installed: shared_skills/' + skill.name + ' (superpowers)');
        }
      }
      return true;
    }
  } catch (e) {
    console.log('  warning: could not fetch superpowers from GitHub: ' + e.message);
  } finally {
    try { fs.rmSync(tmpDir, { recursive: true, force: true }); } catch {}
  }
  return false;
}

/**
 * Install default skills into shared_skills/ based on the manifest.
 */
function installDefaultSkills(workspace) {
  const manifestPath = path.join(TEMPLATES_DIR, 'default-skills.json');
  if (!fs.existsSync(manifestPath)) {
    console.log('  warning: default-skills.json not found, skipping skill install');
    return 0;
  }

  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  const sharedSkills = path.join(workspace, 'shared_skills');
  let installed = 0;

  // Group skills by source
  const bySource = {};
  for (const skill of manifest.skills) {
    if (!bySource[skill.source]) bySource[skill.source] = [];
    bySource[skill.source].push(skill);
  }

  // Install plugin skills
  if (bySource.plugin) {
    for (const skill of bySource.plugin) {
      const dest = path.join(sharedSkills, skill.name);
      if (fs.existsSync(dest)) continue;
      const src = path.join(PLUGIN_ROOT, 'skills', skill.name);
      if (fs.existsSync(src)) {
        copyDirRecursive(src, dest);
        console.log('  installed: shared_skills/' + skill.name + ' (plugin)');
        installed++;
      }
    }
  }

  // Install custom skills (from plugin/templates/skills/)
  if (bySource.custom) {
    for (const skill of bySource.custom) {
      const dest = path.join(sharedSkills, skill.name);
      if (fs.existsSync(dest)) continue;
      const src = path.join(TEMPLATES_DIR, 'skills', skill.name);
      if (fs.existsSync(src)) {
        copyDirRecursive(src, dest);
        console.log('  installed: shared_skills/' + skill.name + ' (custom)');
        installed++;
      }
    }
  }

  // Install superpowers skills
  if (bySource.superpowers) {
    const superpowersNames = bySource.superpowers.map(s => s.name);
    const localSP = findSuperpowersLocal();
    if (localSP) {
      for (const name of superpowersNames) {
        const dest = path.join(sharedSkills, name);
        if (fs.existsSync(dest)) continue;
        const src = path.join(localSP, name);
        if (fs.existsSync(src)) {
          copyDirRecursive(src, dest);
          console.log('  installed: shared_skills/' + name + ' (superpowers/local)');
          installed++;
        }
      }
    } else {
      // Try fetching from GitHub
      const missing = superpowersNames.filter(n => !fs.existsSync(path.join(sharedSkills, n)));
      if (missing.length > 0) {
        fetchSuperpowersFromGithub(sharedSkills);
        installed += missing.filter(n => fs.existsSync(path.join(sharedSkills, n))).length;
      }
    }
  }

  return installed;
}

function initWorkspace(workspace) {
  console.log('claw_core: initializing workspace at ' + workspace);

  let created = 0;
  for (const sub of WORKSPACE_DIRS) {
    const dir = sub ? path.join(workspace, sub) : workspace;
    if (ensureDir(dir)) created++;
  }
  for (const t of TEMPLATE_FILES) {
    if (copyTemplate(t.src, path.join(workspace, t.dest))) created++;
  }

  // Install default skills
  const skillsInstalled = installDefaultSkills(workspace);
  created += skillsInstalled;

  if (created === 0) {
    console.log('claw_core: workspace already initialized');
  } else {
    console.log('claw_core: workspace ready (' + created + ' items created)');
  }
}

function resetWorkspace(workspace) {
  console.log('claw_core: resetting workspace at ' + workspace);

  // 1. Back up shared_memory if it exists and is not empty
  const memDir = path.join(workspace, 'shared_memory');
  if (fs.existsSync(memDir)) {
    const files = fs.readdirSync(memDir);
    if (files.length > 0) {
      const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
      const backupDir = path.join(workspace, '.backups', 'shared_memory-' + stamp);
      fs.mkdirSync(backupDir, { recursive: true });
      for (const f of files) {
        const src = path.join(memDir, f);
        const dest = path.join(backupDir, f);
        if (fs.statSync(src).isFile()) {
          fs.copyFileSync(src, dest);
        }
      }
      console.log('  backed up shared_memory to .backups/shared_memory-' + stamp);
    }
  }

  // 2. Remove workspace contents (keep .backups)
  if (fs.existsSync(workspace)) {
    const entries = fs.readdirSync(workspace);
    for (const entry of entries) {
      if (entry === '.backups') continue;
      const full = path.join(workspace, entry);
      fs.rmSync(full, { recursive: true, force: true });
    }
    console.log('  cleared workspace (backups preserved)');
  }

  // 3. Recreate from scratch
  initWorkspace(workspace);
  console.log('claw_core: workspace reset complete');
}

function main() {
  const action = getAction();
  const workspace = getWorkspace();

  if (action === 'init') {
    initWorkspace(workspace);
  } else if (action === 'reset') {
    resetWorkspace(workspace);
  } else {
    console.error('Unknown action: ' + action);
    console.error('Usage: node init-workspace.js {init|reset} [--workspace /path]');
    process.exit(1);
  }
}

main();
