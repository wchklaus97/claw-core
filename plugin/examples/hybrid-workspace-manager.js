/**
 * Hybrid Workspace Manager
 * 
 * 混合策略：預設共享（symlink），按需獨立（copy）
 * Balances disk efficiency with customization flexibility
 * 
 * Run: node examples/hybrid-workspace-manager.js
 */

import path from 'path';
import os from 'os';
import fs from 'fs/promises';

/**
 * Hybrid Session Workspace Manager
 * - Default: symlink (99% of sessions)
 * - On-demand: copy (premium/custom users)
 * - Dynamic: can break symlink to copy
 */
class HybridWorkspaceManager {
  constructor(options = {}) {
    this.baseDir = options.baseDir || path.join(os.homedir(), '.openclaw', 'workspaces');
    this.globalSkills = options.globalSkills || path.join(os.homedir(), '.openclaw', 'shared_skills');
    this.sessions = new Map();
    this.customSessions = new Set();
  }

  /**
   * Mark a session as needing custom skills
   */
  markAsCustom(sessionId) {
    this.customSessions.add(sessionId);
  }

  /**
   * Check if session needs custom skills
   */
  needsCustomSkills(sessionId, userProfile = {}) {
    // 1. Explicitly marked
    if (this.customSessions.has(sessionId)) return true;
    
    // 2. User tier
    if (userProfile.tier === 'premium' || userProfile.tier === 'enterprise') return true;
    
    // 3. Custom skills requested
    if (userProfile.customSkills) return true;
    
    // 4. Requires isolation
    if (userProfile.requiresIsolation) return true;
    
    return false;
  }

  /**
   * Get or create workspace (auto-determines skills strategy)
   */
  async getWorkspace(sessionId, userProfile = {}) {
    if (this.sessions.has(sessionId)) {
      const session = this.sessions.get(sessionId);
      session.lastUsed = new Date();
      return session;
    }

    const workspace = path.join(this.baseDir, `session-${sessionId}`);
    
    // Auto-determine strategy
    const skillsStrategy = this.needsCustomSkills(sessionId, userProfile) 
      ? 'copy' 
      : 'symlink';

    await this.initializeWorkspace(workspace, skillsStrategy);
    
    const sessionInfo = {
      sessionId,
      workspace,
      skillsStrategy,
      userProfile,
      createdAt: new Date(),
      lastUsed: new Date(),
    };
    
    this.sessions.set(sessionId, sessionInfo);
    return sessionInfo;
  }

  /**
   * Initialize workspace structure
   */
  async initializeWorkspace(workspace, skillsStrategy) {
    const dirs = [
      workspace,
      path.join(workspace, 'shared_memory'),
      path.join(workspace, 'projects'),
      path.join(workspace, 'generated'),
      path.join(workspace, 'generated', 'images'),
      path.join(workspace, 'generated', 'exports'),
    ];

    for (const dir of dirs) {
      await fs.mkdir(dir, { recursive: true });
    }

    await this.setupSkills(workspace, skillsStrategy);
    await this.createWorkspaceFiles(workspace);

    console.log(`✓ Initialized workspace: ${workspace} (skills: ${skillsStrategy})`);
  }

  /**
   * Setup skills directory based on strategy
   */
  async setupSkills(workspace, strategy) {
    const skillsDir = path.join(workspace, 'shared_skills');

    // Ensure global skills directory exists
    await fs.mkdir(this.globalSkills, { recursive: true });

    if (strategy === 'symlink') {
      try {
        // Check if already exists
        const stats = await fs.lstat(skillsDir).catch(() => null);
        if (stats?.isSymbolicLink()) {
          return; // Already linked
        }
        
        // Create symlink
        await fs.symlink(this.globalSkills, skillsDir, 'dir');
        console.log(`  shared_skills: symlinked to ${this.globalSkills}`);
      } catch (error) {
        console.warn(`  Warning: failed to create symlink, creating empty dir`);
        await fs.mkdir(skillsDir, { recursive: true });
      }
    } else {
      // Copy strategy
      try {
        const hasGlobalSkills = await fs.access(this.globalSkills)
          .then(() => true)
          .catch(() => false);
        
        if (hasGlobalSkills) {
          await this.copyDir(this.globalSkills, skillsDir);
          console.log(`  shared_skills: copied from ${this.globalSkills}`);
        } else {
          await fs.mkdir(skillsDir, { recursive: true });
          console.log(`  shared_skills: empty (no global skills found)`);
        }
      } catch (error) {
        await fs.mkdir(skillsDir, { recursive: true });
        console.warn(`  Warning: failed to copy skills: ${error.message}`);
      }
    }
  }

  /**
   * Break symlink and convert to independent copy
   */
  async breakSymlink(sessionId) {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error(`Session not found: ${sessionId}`);
    }
    
    const skillsDir = path.join(session.workspace, 'shared_skills');
    
    // Check if it's a symlink
    const stats = await fs.lstat(skillsDir).catch(() => null);
    if (!stats) {
      throw new Error(`Skills directory not found: ${skillsDir}`);
    }
    
    if (!stats.isSymbolicLink()) {
      console.log(`Session ${sessionId} already has independent skills`);
      return { alreadyIndependent: true };
    }
    
    console.log(`Breaking symlink for session ${sessionId}...`);
    
    // Remove symlink
    await fs.unlink(skillsDir);
    
    // Copy skills
    await this.copyDir(this.globalSkills, skillsDir);
    
    // Update session info
    session.skillsStrategy = 'copy';
    this.markAsCustom(sessionId);
    
    console.log(`✓ Session ${sessionId} now has independent skills`);
    
    return {
      success: true,
      workspace: session.workspace,
      skillsDir
    };
  }

  /**
   * Restore symlink (remove independent copy)
   * WARNING: This will delete any custom skills!
   */
  async restoreSymlink(sessionId, options = {}) {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error(`Session not found: ${sessionId}`);
    }
    
    const skillsDir = path.join(session.workspace, 'shared_skills');
    
    // Check if it's already a symlink
    const stats = await fs.lstat(skillsDir).catch(() => null);
    if (stats?.isSymbolicLink()) {
      console.log(`Session ${sessionId} already uses symlink`);
      return { alreadySymlink: true };
    }
    
    // Check for custom skills (unless force)
    if (!options.force) {
      const hasCustom = await this.hasCustomSkills(skillsDir);
      if (hasCustom) {
        throw new Error(
          `Session ${sessionId} has custom skills. ` +
          `Use --force to delete them and restore symlink.`
        );
      }
    }
    
    console.log(`Restoring symlink for session ${sessionId}...`);
    
    // Remove independent copy
    await fs.rm(skillsDir, { recursive: true, force: true });
    
    // Create symlink
    await fs.symlink(this.globalSkills, skillsDir, 'dir');
    
    // Update session info
    session.skillsStrategy = 'symlink';
    this.customSessions.delete(sessionId);
    
    console.log(`✓ Session ${sessionId} restored to symlink`);
    
    return {
      success: true,
      workspace: session.workspace
    };
  }

  /**
   * Add custom skill to a session (auto-breaks symlink if needed)
   */
  async addCustomSkill(sessionId, skillName, skillContent) {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error(`Session not found: ${sessionId}`);
    }
    
    // Ensure independent skills
    await this.breakSymlink(sessionId);
    
    const skillPath = path.join(session.workspace, 'shared_skills', skillName);
    await fs.mkdir(skillPath, { recursive: true });
    
    await fs.writeFile(
      path.join(skillPath, 'SKILL.md'),
      skillContent
    );
    
    console.log(`✓ Added custom skill '${skillName}' to session ${sessionId}`);
    
    return { skillPath };
  }

  /**
   * Check if skills directory has custom skills
   */
  async hasCustomSkills(skillsDir) {
    try {
      const globalSkills = await fs.readdir(this.globalSkills);
      const localSkills = await fs.readdir(skillsDir);
      
      // Check for skills not in global
      const customSkills = localSkills.filter(s => !globalSkills.includes(s));
      return customSkills.length > 0;
    } catch {
      return false;
    }
  }

  /**
   * List all sessions with their skills strategy
   */
  listSessions() {
    return Array.from(this.sessions.values()).map(session => ({
      sessionId: session.sessionId,
      workspace: session.workspace,
      skillsStrategy: session.skillsStrategy,
      userTier: session.userProfile.tier || 'free',
      createdAt: session.createdAt,
      lastUsed: session.lastUsed,
    }));
  }

  /**
   * Generate disk usage report
   */
  async generateDiskReport() {
    const sessions = this.listSessions();
    
    const symlinked = sessions.filter(s => s.skillsStrategy === 'symlink');
    const copied = sessions.filter(s => s.skillsStrategy === 'copy');
    
    const avgSkillsSize = 15; // MB
    const symlinkDisk = 0;
    const copiedDisk = copied.length * avgSkillsSize;
    const fullCopyDisk = sessions.length * avgSkillsSize;
    
    return {
      totalSessions: sessions.length,
      symlinked: symlinked.length,
      copied: copied.length,
      diskUsed: copiedDisk,
      diskSaved: fullCopyDisk - copiedDisk,
      efficiency: ((fullCopyDisk - copiedDisk) / fullCopyDisk * 100).toFixed(1) + '%'
    };
  }

  /**
   * Recursively copy directory
   */
  async copyDir(src, dest) {
    await fs.mkdir(dest, { recursive: true });
    const entries = await fs.readdir(src, { withFileTypes: true });
    
    for (const entry of entries) {
      const srcPath = path.join(src, entry.name);
      const destPath = path.join(dest, entry.name);
      
      if (entry.isDirectory()) {
        await this.copyDir(srcPath, destPath);
      } else {
        await fs.copyFile(srcPath, destPath);
      }
    }
  }

  /**
   * Create workspace metadata files
   */
  async createWorkspaceFiles(workspace) {
    const readmePath = path.join(workspace, 'WORKSPACE.md');
    const readmeContent = `# Workspace

Created: ${new Date().toISOString()}

## Structure

- \`shared_memory/\` - Persistent memory
- \`shared_skills/\` - Skills (may be symlinked or independent)
- \`projects/\` - Project files
- \`generated/\` - Generated output
  - \`images/\` - Cursor-generated images
  - \`exports/\` - Other exports
`;
    await fs.writeFile(readmePath, readmeContent);

    const gitignorePath = path.join(workspace, '.gitignore');
    const gitignoreContent = `generated/\nprojects/\n`;
    await fs.writeFile(gitignorePath, gitignoreContent);
  }

  /**
   * Cleanup old workspaces
   */
  async cleanup(daysOld = 7) {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - daysOld);

    const toDelete = [];
    for (const [sessionId, info] of this.sessions.entries()) {
      if (info.lastUsed < cutoff) {
        toDelete.push(sessionId);
      }
    }

    for (const sessionId of toDelete) {
      const info = this.sessions.get(sessionId);
      try {
        await fs.rm(info.workspace, { recursive: true, force: true });
        this.sessions.delete(sessionId);
        console.log(`✓ Cleaned up workspace for session: ${sessionId}`);
      } catch (error) {
        console.error(`✗ Failed to clean session ${sessionId}:`, error.message);
      }
    }

    return toDelete.length;
  }
}

/**
 * Example usage scenarios
 */
async function main() {
  console.log('🚀 Hybrid Workspace Manager Example\n');

  const manager = new HybridWorkspaceManager();

  // Scenario 1: Standard users (auto symlink)
  console.log('📋 Scenario 1: Standard users (symlink)');
  console.log('─'.repeat(60));

  const alice = await manager.getWorkspace('alice-123', { tier: 'free' });
  const bob = await manager.getWorkspace('bob-456', { tier: 'standard' });
  const carol = await manager.getWorkspace('carol-789', { tier: 'free' });

  console.log(`\nCreated 3 standard users with symlinked skills`);

  // Scenario 2: Premium user (auto copy)
  console.log('\n📋 Scenario 2: Premium user (independent copy)');
  console.log('─'.repeat(60));

  const vip = await manager.getWorkspace('vip-999', { 
    tier: 'premium',
    customSkills: true 
  });

  console.log(`\nVIP user gets independent skills automatically`);

  // Scenario 3: Dynamic upgrade (break symlink)
  console.log('\n📋 Scenario 3: User upgrade (break symlink)');
  console.log('─'.repeat(60));

  console.log(`\nAlice upgrades to premium and needs custom skills...`);
  await manager.breakSymlink('alice-123');

  // Add custom skill
  await manager.addCustomSkill('alice-123', 'alice-custom-workflow', `
---
name: alice-custom-workflow
description: Alice's custom workflow for her specific needs
---

# Alice's Custom Workflow

This is a personalized skill for Alice...
`);

  // Scenario 4: Disk usage report
  console.log('\n📋 Scenario 4: Disk usage report');
  console.log('─'.repeat(60));

  const report = await manager.generateDiskReport();
  console.log(`\nDisk Usage Report:`);
  console.log(`  Total Sessions:      ${report.totalSessions}`);
  console.log(`  Symlinked:           ${report.symlinked} sessions (0 MB)`);
  console.log(`  Independent Copy:    ${report.copied} sessions (~${report.diskUsed} MB)`);
  console.log(`  Disk Saved:          ~${report.diskSaved} MB (${report.efficiency} efficiency)`);

  // Scenario 5: Session list
  console.log('\n📋 Scenario 5: All sessions');
  console.log('─'.repeat(60));

  const sessions = manager.listSessions();
  console.table(sessions.map(s => ({
    Session: s.sessionId,
    Strategy: s.skillsStrategy,
    Tier: s.userTier,
    Created: s.createdAt.toISOString().split('T')[0]
  })));

  // Summary
  console.log('\n' + '═'.repeat(60));
  console.log('✅ Hybrid Strategy Summary:');
  console.log(`  • ${report.symlinked} sessions share skills (0 MB)`);
  console.log(`  • ${report.copied} sessions have independent skills (~${report.diskUsed} MB)`);
  console.log(`  • Saved ${report.diskSaved} MB vs full copy strategy`);
  console.log(`  • ${report.efficiency} disk efficiency`);
  console.log('\n💡 Best of both worlds: efficiency + flexibility!');
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(console.error);
}

export { HybridWorkspaceManager };
