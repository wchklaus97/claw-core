/**
 * Workspace Isolation Example
 * 
 * This example demonstrates how to handle multiple concurrent users
 * with isolated workspaces when calling cursor_agent_direct.
 * 
 * Run: node examples/workspace-isolation-example.js
 */

import path from 'path';
import os from 'os';
import fs from 'fs/promises';

/**
 * Simple session manager that creates isolated workspaces
 */
class SessionWorkspaceManager {
  constructor(baseDir = null, options = {}) {
    this.baseDir = baseDir || path.join(os.homedir(), '.openclaw', 'workspaces');
    this.sessions = new Map();
    this.skillsStrategy = options.skillsStrategy || 'symlink'; // 'symlink' | 'copy' | 'none'
  }

  /**
   * Get or create workspace for a session
   */
  async getWorkspace(sessionId) {
    if (this.sessions.has(sessionId)) {
      return this.sessions.get(sessionId);
    }

    const workspace = path.join(this.baseDir, `session-${sessionId}`);
    
    // Create workspace structure with skills strategy
    await this.initializeWorkspace(workspace, {
      skillsStrategy: this.skillsStrategy
    });
    
    const sessionInfo = {
      workspace,
      createdAt: new Date(),
      lastUsed: new Date(),
      skillsStrategy: this.skillsStrategy,
    };
    
    this.sessions.set(sessionId, sessionInfo);
    return sessionInfo;
  }

  /**
   * Initialize workspace with standard structure
   * 
   * Options:
   * - skillsStrategy: 'symlink' (default) | 'copy' | 'none'
   */
  async initializeWorkspace(workspace, options = {}) {
    const skillsStrategy = options.skillsStrategy || 'symlink';
    
    const dirs = [
      workspace,
      path.join(workspace, 'shared_memory'),
      path.join(workspace, 'projects'),
      path.join(workspace, 'generated'),
      path.join(workspace, 'generated', 'images'),
      path.join(workspace, 'generated', 'exports'),
    ];

    // Create base directories (excluding shared_skills for now)
    for (const dir of dirs) {
      await fs.mkdir(dir, { recursive: true });
    }

    // Handle shared_skills based on strategy
    await this.setupSharedSkills(workspace, skillsStrategy);

    // Create WORKSPACE.md
    const readmePath = path.join(workspace, 'WORKSPACE.md');
    const readmeContent = `# Workspace for Session

Created: ${new Date().toISOString()}

## Structure

- \`shared_memory/\` - Persistent memory across tasks
- \`shared_skills/\` - Session-specific skills
- \`projects/\` - Project files
- \`generated/\` - Generated output
  - \`images/\` - Cursor-generated images
  - \`exports/\` - Other exports

## Usage

This workspace is isolated from other sessions.
All Cursor operations will use this directory as root.
`;
    await fs.writeFile(readmePath, readmeContent);

    // Create .gitignore
    const gitignorePath = path.join(workspace, '.gitignore');
    const gitignoreContent = `# Ignore generated output
generated/

# Ignore local projects
projects/
`;
    await fs.writeFile(gitignorePath, gitignoreContent);

    console.log(`✓ Initialized workspace: ${workspace}`);
  }

  /**
   * Setup shared_skills directory based on strategy
   */
  async setupSharedSkills(workspace, strategy) {
    const skillsDir = path.join(workspace, 'shared_skills');
    const globalSkillsDir = path.join(os.homedir(), '.openclaw', 'shared_skills');

    switch (strategy) {
      case 'symlink': {
        // Create global skills directory if it doesn't exist
        await fs.mkdir(globalSkillsDir, { recursive: true });
        
        // Create symlink to global skills
        try {
          // Check if already exists
          const stats = await fs.lstat(skillsDir).catch(() => null);
          if (stats?.isSymbolicLink()) {
            console.log(`  shared_skills: symlink already exists`);
            return;
          }
          
          await fs.symlink(globalSkillsDir, skillsDir, 'dir');
          console.log(`  shared_skills: symlinked to ${globalSkillsDir}`);
        } catch (error) {
          console.warn(`  shared_skills: failed to create symlink, falling back to empty dir`);
          await fs.mkdir(skillsDir, { recursive: true });
        }
        break;
      }

      case 'copy': {
        // Copy skills from global location if it exists
        if (await fs.access(globalSkillsDir).then(() => true).catch(() => false)) {
          await this.copyDir(globalSkillsDir, skillsDir);
          console.log(`  shared_skills: copied from ${globalSkillsDir}`);
        } else {
          await fs.mkdir(skillsDir, { recursive: true });
          console.log(`  shared_skills: empty (no global skills found)`);
        }
        break;
      }

      case 'none':
      default: {
        // Create empty directory
        await fs.mkdir(skillsDir, { recursive: true });
        console.log(`  shared_skills: empty directory created`);
        break;
      }
    }
  }

  /**
   * Recursively copy a directory
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
   * Update last used timestamp
   */
  touch(sessionId) {
    if (this.sessions.has(sessionId)) {
      this.sessions.get(sessionId).lastUsed = new Date();
    }
  }

  /**
   * Clean up old workspaces (older than N days)
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

  /**
   * List all active sessions
   */
  listSessions() {
    return Array.from(this.sessions.entries()).map(([id, info]) => ({
      sessionId: id,
      workspace: info.workspace,
      createdAt: info.createdAt,
      lastUsed: info.lastUsed,
    }));
  }
}

/**
 * Example: Mock OpenClaw tool call
 * Replace this with actual OpenClaw client call
 */
async function callCursorAgentTool(params) {
  console.log('\n📞 Calling cursor_agent_direct with params:');
  console.log(JSON.stringify(params, null, 2));
  
  // In real usage, this would be:
  // return await openclaw.callTool('cursor_agent_direct', params);
  
  // Mock response
  return {
    ok: true,
    output: `Executed in workspace: ${params.workspace}`,
    files_created: [
      path.join(params.workspace, 'generated', 'images', 'example.png')
    ],
  };
}

/**
 * Example usage scenarios
 */
async function main() {
  console.log('🚀 Workspace Isolation Example\n');

  // Use symlink strategy for efficient skills sharing
  const manager = new SessionWorkspaceManager(null, { skillsStrategy: 'symlink' });

  // Scenario 1: Two users making concurrent requests
  console.log('📋 Scenario 1: Concurrent users');
  console.log('─'.repeat(50));

  const aliceSession = 'alice-' + Date.now();
  const bobSession = 'bob-' + Date.now();

  // Alice generates a cat image
  const aliceWorkspace = await manager.getWorkspace(aliceSession);
  await callCursorAgentTool({
    prompt: 'Generate an image of a cute cat',
    workspace: aliceWorkspace.workspace,
  });
  manager.touch(aliceSession);

  // Bob generates a dog image (at the same time)
  const bobWorkspace = await manager.getWorkspace(bobSession);
  await callCursorAgentTool({
    prompt: 'Generate an image of a playful dog',
    workspace: bobWorkspace.workspace,
  });
  manager.touch(bobSession);

  console.log('\n✓ Both requests isolated in different workspaces!');
  console.log(`  Alice: ${aliceWorkspace.workspace}`);
  console.log(`  Bob: ${bobWorkspace.workspace}`);

  // Scenario 2: List active sessions
  console.log('\n📋 Scenario 2: List active sessions');
  console.log('─'.repeat(50));
  
  const sessions = manager.listSessions();
  console.table(sessions);

  // Scenario 3: Session continuation (reusing workspace)
  console.log('\n📋 Scenario 3: Continue Alice\'s session');
  console.log('─'.repeat(50));

  const aliceWorkspace2 = await manager.getWorkspace(aliceSession);
  console.log(`Reusing workspace: ${aliceWorkspace2.workspace}`);
  await callCursorAgentTool({
    prompt: 'Now generate a variation with a hat',
    workspace: aliceWorkspace2.workspace,
  });

  // Scenario 4: Cleanup old sessions
  console.log('\n📋 Scenario 4: Cleanup (would delete sessions older than 7 days)');
  console.log('─'.repeat(50));
  console.log('In production, run this periodically:');
  console.log('  const deleted = await manager.cleanup(7);');
  console.log('  console.log(`Cleaned up ${deleted} old sessions`);');

  // Summary
  console.log('\n' + '═'.repeat(50));
  console.log('📊 Summary:');
  console.log(`  Total sessions created: ${sessions.length}`);
  console.log(`  Base directory: ${manager.baseDir}`);
  console.log('\n✅ Workspace isolation working correctly!');
  console.log('\nℹ️  To use in production:');
  console.log('  1. Replace callCursorAgentTool() with real OpenClaw client');
  console.log('  2. Set up periodic cleanup job');
  console.log('  3. Monitor workspace disk usage');
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(console.error);
}

export { SessionWorkspaceManager };
