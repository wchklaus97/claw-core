/**
 * OpenClaw plugin: Claw Core — Terminal Runtime Layer integration
 *
 * Features:
 * - Auto-starts claw_core daemon, provides skills and CLI
 * - Agent tools: cursor_agent_direct, picoclaw_chat, picoclaw_config, team_coordinate
 * - Multi-bot setup: 3 specialized Telegram bots (artist, assistant, developer)
 * - Agent Teams: multi-agent collaboration with shared task board
 * - PicoClaw bridge: chat, config, status
 */
import { spawn, execSync } from "child_process";
import { existsSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

const PLUGIN_ROOT = dirname(fileURLToPath(import.meta.url));

// Try loading SDK helper; may not be available in all OpenClaw versions.
let sdkRegisterHooks: ((api: object, dir: string) => void) | undefined;
try {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const sdk = require("openclaw/plugin-sdk");
  sdkRegisterHooks = sdk.registerPluginHooksFromDir;
} catch {
  // SDK not available — will fall back to api.registerPluginHooksFromDir
}

function getDaemonScript(): string {
  return join(PLUGIN_ROOT, "scripts", "claw_core_daemon.sh");
}

function getExecScript(): string {
  return join(PLUGIN_ROOT, "scripts", "claw_core_exec.py");
}

function getCursorAgentScript(): string {
  return join(PLUGIN_ROOT, "scripts", "cursor_agent_direct.py");
}

function getPicoClawScript(): string {
  return join(PLUGIN_ROOT, "scripts", "picoclaw_client.py");
}

function getSetupBotsScript(): string {
  return join(PLUGIN_ROOT, "scripts", "setup_bots.py");
}

function getTeamSessionScript(): string {
  return join(PLUGIN_ROOT, "scripts", "team_session.py");
}

/**
 * Resolve workspace path with priority order:
 * 1. Explicit params.workspace (highest priority)
 * 2. Derive from _id if it contains agent/session info
 * 3. Agent-specific workspace (for telegram bots, etc.)
 * 4. pluginConfig.defaultWorkspace (fallback)
 * 5. Empty string (Cursor uses cwd)
 *
 * USAGE: When calling cursor_agent_direct from other systems, pass workspace explicitly:
 * {
 *   prompt: "...",
 *   workspace: deriveWorkspaceForSession(sessionId)  // Your logic here
 * }
 *
 * @param _id Tool invocation ID (may contain agent/session context)
 * @param params Tool parameters
 * @param pluginConfig Plugin configuration
 * @returns Resolved workspace path
 */
function resolveWorkspace(
  _id: string,
  params: Record<string, unknown>,
  pluginConfig: Record<string, unknown>,
): string {
  // Priority 1: Explicit parameter (highest)
  if (params.workspace && typeof params.workspace === "string") {
    return params.workspace;
  }

  // Priority 2: Try to extract agent/session from _id
  // OpenClaw may pass context in _id format like "agent:bot-artist:session:abc123"
  // or "session:abc123" or other formats
  const agentMatch = _id.match(/agent[:-]([^:]+)/i);
  const sessionMatch = _id.match(/session[:-]([^:]+)/i);

  if (agentMatch) {
    const agentId = agentMatch[1];
    // Skip generic agent names, focus on specific bots
    if (agentId && agentId !== "main" && agentId !== "cursor-dev" && agentId !== "default") {
      const agentWorkspace = join(
        process.env.HOME || "~",
        ".openclaw",
        `workspace-${agentId}`,
      );
      return agentWorkspace;
    }
  }

  if (sessionMatch && pluginConfig.workspaceStrategy === "per-session") {
    const sessionId = sessionMatch[1];
    const workspaceBase = (pluginConfig.workspaceBase as string) || 
      join(process.env.HOME || "~", ".openclaw", "workspaces");
    return join(workspaceBase, `session-${sessionId}`);
  }

  // Priority 3: Default workspace from config
  if (pluginConfig.defaultWorkspace && typeof pluginConfig.defaultWorkspace === "string") {
    return pluginConfig.defaultWorkspace;
  }

  // Priority 4: Empty (Cursor will use cwd)
  return "";
}

function getTeamSetupTelegramScript(): string {
  return join(PLUGIN_ROOT, "scripts", "team_setup_telegram.py");
}

/** Run a Python script and return parsed JSON output */
function runPythonScript(
  scriptPath: string,
  args: string[],
  timeout = 120000,
): Promise<{ ok: boolean; data: unknown; raw: string }> {
  return new Promise((resolve) => {
    const child = spawn("python3", [scriptPath, ...args], {
      timeout,
      env: { ...process.env, CLAW_CORE_PLUGIN_ROOT: PLUGIN_ROOT },
    });
    let stdout = "";
    let stderr = "";
    child.stdout?.on("data", (d: Buffer) => (stdout += d.toString()));
    child.stderr?.on("data", (d: Buffer) => (stderr += d.toString()));
    child.on("close", (code) => {
      try {
        const data = JSON.parse(stdout.trim());
        resolve({ ok: code === 0, data, raw: stdout.trim() });
      } catch {
        resolve({
          ok: false,
          data: { error: stderr.trim() || stdout.trim() || `exit code ${code}` },
          raw: stdout.trim() || stderr.trim(),
        });
      }
    });
    child.on("error", (err) => {
      resolve({ ok: false, data: { error: err.message }, raw: "" });
    });
  });
}

/** Check if a binary is available on PATH */
function isBinaryAvailable(name: string): boolean {
  try {
    execSync(`which ${name} 2>/dev/null`, { stdio: "pipe" });
    return true;
  } catch {
    return false;
  }
}

// -------------------------------------------------------------------
// Plugin API types (relaxed to support varying OpenClaw versions)
// -------------------------------------------------------------------
interface PluginApi {
  registerPluginHooksFromDir?: (api: object, dir: string) => void;
  registerCli: (
    fn: (opts: {
      program: {
        command: (name: string) => {
          description: (d: string) => {
            option: (flags: string, desc: string) => unknown;
            action: (fn: (...args: unknown[]) => void) => void;
          };
        };
      };
    }) => void,
    opts?: { commands: string[] },
  ) => void;
  registerGatewayMethod: (
    name: string,
    handler: (opts: {
      params?: Record<string, unknown>;
      respond: (ok: boolean, data: unknown) => void;
    }) => void,
  ) => void;
  registerTool?: (
    tool: {
      name: string;
      description: string;
      parameters: Record<string, unknown>;
      execute: (
        id: string,
        params: Record<string, unknown>,
      ) => Promise<{ content: Array<{ type: string; text?: string; data?: string; mimeType?: string }> }>;
    },
    opts?: { optional: boolean },
  ) => void;
  logger?: { info: (msg: string) => void; warn: (msg: string) => void };
  config?: {
    plugins?: {
      entries?: Record<string, { config?: Record<string, string> }>;
    };
  };
}

// -------------------------------------------------------------------
// Main plugin registration
// -------------------------------------------------------------------
export default function register(api: PluginApi) {
  const pluginConfig =
    api.config?.plugins?.entries?.["claw-core"]?.config ?? {};

  // Register boot hook (API or SDK may provide registerPluginHooksFromDir)
  const registerHooks = api.registerPluginHooksFromDir ?? sdkRegisterHooks;
  if (typeof registerHooks === "function") {
    registerHooks(api as object, join(PLUGIN_ROOT, "hooks"));
  } else {
    api.logger?.warn(
      "claw-core: registerPluginHooksFromDir not available; boot hook may not load. Start daemon manually: openclaw clawcore start",
    );
  }

  const daemonScript = getDaemonScript();
  const execScript = getExecScript();
  const cursorScript = getCursorAgentScript();
  const picoScript = getPicoClawScript();
  const setupScript = getSetupBotsScript();
  const teamScript = getTeamSessionScript();
  const teamTelegramScript = getTeamSetupTelegramScript();

  // ---------------------------------------------------------------
  // CLI: openclaw clawcore start|stop|restart|status|setup-cursor|init-workspace|reset-workspace|teardown|setup-bots
  // ---------------------------------------------------------------
  api.registerCli(
    ({ program }) => {
      const cmd = program
        .command("clawcore <action>")
        .description(
          "Manage claw_core daemon, workspace, multi-bot setup, and agent teams (start|stop|restart|status|setup-cursor|init-workspace|reset-workspace|teardown|setup-bots|team)",
        );

      cmd.action((...args: unknown[]) => {
        const act = (args[0] as string) ?? "status";

        // init-workspace / reset-workspace: create or reset the claw_core workspace
        if (act === "init-workspace" || act === "reset-workspace") {
          const initScript = join(PLUGIN_ROOT, "scripts", "init-workspace.js");
          if (!existsSync(initScript)) {
            console.error("Workspace init script not found:", initScript);
            process.exit(1);
          }
          const wsAction = act === "reset-workspace" ? "reset" : "init";
          const env = { ...process.env } as Record<string, string>;
          const args = ["node", initScript, wsAction];
          const wsIdx = process.argv.indexOf("--workspace");
          if (wsIdx !== -1 && process.argv[wsIdx + 1]) {
            args.push("--workspace", process.argv[wsIdx + 1]);
          }
          const child = spawn(args[0], args.slice(1), { env, stdio: "inherit" });
          child.on("close", (code) => process.exit(code ?? 0));
          return;
        }

        // teardown: stop daemon + clean openclaw.json and skills (run before rm plugin dir)
        if (act === "teardown") {
          const teardownScript = join(PLUGIN_ROOT, "scripts", "teardown-openclaw-config.js");
          if (!existsSync(teardownScript)) {
            console.error("Teardown script not found:", teardownScript);
            process.exit(1);
          }
          const daemonScript = getDaemonScript();
          if (existsSync(daemonScript)) {
            const stopChild = spawn("bash", [daemonScript, "stop"], {
              env: { ...process.env, CLAW_CORE_PLUGIN_ROOT: PLUGIN_ROOT },
              stdio: "inherit",
            });
            stopChild.on("close", () => {
              const teardownChild = spawn("node", [teardownScript], {
                env: { ...process.env, PLUGIN_ROOT, CLAW_CORE_PLUGIN_ROOT: PLUGIN_ROOT },
                stdio: "inherit",
              });
              teardownChild.on("close", (code) => process.exit(code ?? 0));
            });
          } else {
            const teardownChild = spawn("node", [teardownScript], {
              env: { ...process.env, PLUGIN_ROOT, CLAW_CORE_PLUGIN_ROOT: PLUGIN_ROOT },
              stdio: "inherit",
            });
            teardownChild.on("close", (code) => process.exit(code ?? 0));
          }
          return;
        }

        // setup-cursor: run the Cursor integration setup script
        if (act === "setup-cursor") {
          const setupCursorScript = join(PLUGIN_ROOT, "scripts", "setup-cursor-integration.js");
          if (!existsSync(setupCursorScript)) {
            console.error("Cursor setup script not found:", setupCursorScript);
            process.exit(1);
          }
          const env = { ...process.env } as Record<string, string>;
          const wsIdx = process.argv.indexOf("--workspace");
          const args = ["node", setupCursorScript];
          if (wsIdx !== -1 && process.argv[wsIdx + 1]) {
            args.push("--workspace", process.argv[wsIdx + 1]);
          }
          const child = spawn(args[0], args.slice(1), { env, stdio: "inherit" });
          child.on("close", (code) => process.exit(code ?? 0));
          return;
        }

        // setup-bots: delegates to the Python setup script
        if (act === "setup-bots") {
          if (!existsSync(setupScript)) {
            console.error("setup_bots.py not found:", setupScript);
            process.exit(1);
          }
          const child = spawn("python3", [setupScript, ...process.argv.slice(4)], {
            env: { ...process.env, CLAW_CORE_PLUGIN_ROOT: PLUGIN_ROOT },
            stdio: "inherit",
          });
          child.on("close", (code) => process.exit(code ?? 0));
          return;
        }

        // team delegates to team_session.py or team_setup_telegram.py
        if (act === "team") {
          const teamArgs = process.argv.slice(4); // everything after "clawcore team"
          const teamSubcmd = teamArgs[0] || "list";

          // "team setup-telegram" routes to team_setup_telegram.py
          if (teamSubcmd === "setup-telegram") {
            if (!existsSync(teamTelegramScript)) {
              console.error("team_setup_telegram.py not found:", teamTelegramScript);
              process.exit(1);
            }
            const child = spawn("python3", [teamTelegramScript, ...teamArgs.slice(1)], {
              env: { ...process.env, CLAW_CORE_PLUGIN_ROOT: PLUGIN_ROOT },
              stdio: "inherit",
            });
            child.on("close", (code) => process.exit(code ?? 0));
            return;
          }

          // All other team subcommands route to team_session.py
          if (!existsSync(teamScript)) {
            console.error("team_session.py not found:", teamScript);
            process.exit(1);
          }
          const child = spawn("python3", [teamScript, ...teamArgs], {
            env: { ...process.env, CLAW_CORE_PLUGIN_ROOT: PLUGIN_ROOT },
            stdio: "inherit",
          });
          child.on("close", (code) => process.exit(code ?? 0));
          return;
        }

        // Standard daemon management
        if (!existsSync(daemonScript)) {
          console.error("claw_core daemon script not found:", daemonScript);
          process.exit(1);
        }
        const env: Record<string, string> = {
          ...process.env,
          CLAW_CORE_PLUGIN_ROOT: PLUGIN_ROOT,
        };
        if (pluginConfig.binaryPath) env.CLAW_CORE_BINARY = pluginConfig.binaryPath;
        if (pluginConfig.socketPath) env.CLAW_CORE_SOCKET = pluginConfig.socketPath;
        if (pluginConfig.sourcePath) env.CLAW_CORE_SOURCE = pluginConfig.sourcePath;

        const child = spawn("bash", [daemonScript, act], {
          env,
          stdio: "inherit",
        });
        child.on("close", (code) => process.exit(code ?? 0));
      });
    },
    { commands: ["clawcore"] },
  );

  // ---------------------------------------------------------------
  // CLI: openclaw picoclaw status|config|chat "<msg>"
  // ---------------------------------------------------------------
  api.registerCli(
    ({ program }) => {
      const cmd = program
        .command("picoclaw <action> [message]")
        .description("PicoClaw integration (status|config|chat \"<message>\")");

      cmd.action((...cliArgs: unknown[]) => {
        const action = cliArgs[0] as string | undefined;
        const message = cliArgs[1] as string | undefined;
        if (!existsSync(picoScript)) {
          console.error("picoclaw_client.py not found:", picoScript);
          process.exit(1);
        }
        const act = action ?? "status";
        const spawnArgs: string[] = [picoScript, act];
        if (act === "chat" && message) {
          spawnArgs.push("--message", message);
        }
        const child = spawn("python3", spawnArgs, {
          env: { ...process.env, CLAW_CORE_PLUGIN_ROOT: PLUGIN_ROOT },
          stdio: "inherit",
        });
        child.on("close", (code) => process.exit(code ?? 0));
      });
    },
    { commands: ["picoclaw"] },
  );

  // ---------------------------------------------------------------
  // CLI: openclaw clawcore team create|status|list|close|setup-telegram
  // (handled within clawcore CLI — "team" is a sub-action)
  // ---------------------------------------------------------------

  // ---------------------------------------------------------------
  // Gateway RPC: clawcore.team-create
  // ---------------------------------------------------------------
  api.registerGatewayMethod("clawcore.team-create", ({ params, respond }) => {
    if (!existsSync(teamScript)) {
      respond(false, { error: "team_session.py not found" });
      return;
    }
    const name = (params?.name as string) || "";
    const groupId = (params?.groupId as string) || "";
    if (!name) {
      respond(false, { error: "name parameter is required" });
      return;
    }
    const args = ["create", "--name", name];
    if (groupId) args.push("--group-id", groupId);
    if (params?.repo) args.push("--repo", params.repo as string);
    if (params?.agents) args.push("--agents", params.agents as string);
    if (params?.lead) args.push("--lead", params.lead as string);
    runPythonScript(teamScript, args).then(({ ok, data, raw }) => {
      respond(ok || true, { output: raw, data });
    });
  });

  // ---------------------------------------------------------------
  // Gateway RPC: clawcore.team-status
  // ---------------------------------------------------------------
  api.registerGatewayMethod("clawcore.team-status", ({ params, respond }) => {
    if (!existsSync(teamScript)) {
      respond(false, { error: "team_session.py not found" });
      return;
    }
    const name = (params?.name as string) || "";
    if (!name) {
      respond(false, { error: "name parameter is required" });
      return;
    }
    runPythonScript(teamScript, ["status", "--name", name, "--json"]).then(
      ({ ok, data }) => {
        respond(ok, data);
      },
    );
  });

  // ---------------------------------------------------------------
  // Gateway RPC: clawcore.team-list
  // ---------------------------------------------------------------
  api.registerGatewayMethod("clawcore.team-list", ({ respond }) => {
    if (!existsSync(teamScript)) {
      respond(false, { error: "team_session.py not found" });
      return;
    }
    // team_session.py list outputs text, not JSON — run and capture
    runPythonScript(teamScript, ["list"]).then(({ raw }) => {
      respond(true, { output: raw });
    });
  });

  // ---------------------------------------------------------------
  // Gateway RPC: clawcore.status
  // ---------------------------------------------------------------
  api.registerGatewayMethod("clawcore.status", ({ respond }) => {
    if (!existsSync(daemonScript)) {
      respond(false, { error: "daemon script not found" });
      return;
    }
    const env: Record<string, string> = {
      ...process.env,
      CLAW_CORE_PLUGIN_ROOT: PLUGIN_ROOT,
    };
    if (pluginConfig.socketPath) env.CLAW_CORE_SOCKET = pluginConfig.socketPath;

    const child = spawn("bash", [daemonScript, "status"], { env });
    let stdout = "";
    let stderr = "";
    child.stdout?.on("data", (d: Buffer) => (stdout += d.toString()));
    child.stderr?.on("data", (d: Buffer) => (stderr += d.toString()));
    child.on("close", (code) => {
      const running =
        stdout.includes("✓") && !stdout.includes("✗ claw_core not running");
      respond(true, {
        running,
        code,
        stdout: stdout.trim(),
        stderr: stderr.trim(),
      });
    });
  });

  // ---------------------------------------------------------------
  // Gateway RPC: picoclaw.status
  // ---------------------------------------------------------------
  api.registerGatewayMethod("picoclaw.status", ({ respond }) => {
    if (!existsSync(picoScript)) {
      respond(false, { error: "picoclaw_client.py not found" });
      return;
    }
    runPythonScript(picoScript, ["status"]).then(({ ok, data }) => {
      respond(ok, data);
    });
  });

  // ---------------------------------------------------------------
  // Gateway RPC: picoclaw.chat
  // ---------------------------------------------------------------
  api.registerGatewayMethod("picoclaw.chat", ({ params, respond }) => {
    if (!existsSync(picoScript)) {
      respond(false, { error: "picoclaw_client.py not found" });
      return;
    }
    const message = (params?.message as string) || "";
    if (!message) {
      respond(false, { error: "message parameter is required" });
      return;
    }
    runPythonScript(picoScript, ["chat", "--message", message], 180000).then(
      ({ ok, data }) => {
        respond(ok, data);
      },
    );
  });

  // ---------------------------------------------------------------
  // Gateway RPC: clawcore.bots-status
  // ---------------------------------------------------------------
  api.registerGatewayMethod("clawcore.bots-status", ({ respond }) => {
    const cursorAvailable = isBinaryAvailable(
      pluginConfig.cursorPath || "cursor",
    );
    const picoClawAvailable = isBinaryAvailable(
      pluginConfig.picoClawPath || "picoclaw",
    );
    const clawCoreSocket = pluginConfig.socketPath || "/tmp/trl.sock";
    const clawCoreRunning = existsSync(clawCoreSocket);

    respond(true, {
      backends: {
        cursor: { available: cursorAvailable },
        picoclaw: { available: picoClawAvailable },
        clawCore: { available: clawCoreRunning, socket: clawCoreSocket },
      },
      agents: ["artist", "assistant", "developer"],
    });
  });

  // ---------------------------------------------------------------
  // Agent Tools (require api.registerTool — may not exist in older
  // OpenClaw versions, so wrapped in try/catch)
  // ---------------------------------------------------------------
  if (typeof api.registerTool === "function") {
    const registeredTools: string[] = [];
    const skippedTools: string[] = [];

    // Tool: cursor_agent_direct
    const enableCursor = pluginConfig.enableCursorDirect !== "false";
    if (enableCursor && existsSync(cursorScript)) {
      api.registerTool(
        {
          name: "cursor_agent_direct",
          description:
            "Invoke Cursor Agent directly for coding tasks, image generation, complex multi-file operations. " +
            "Cursor auto-selects the best model (including image generation via auto model). " +
            "Use for: coding, refactoring, image creation, design tasks, complex analysis.",
          parameters: {
            type: "object",
            properties: {
              prompt: {
                type: "string",
                description:
                  "The prompt to send to Cursor Agent. Be specific and detailed.",
              },
              workspace: {
                type: "string",
                description:
                  "Workspace path for Cursor to operate in (optional, defaults to current workspace).",
              },
              model: {
                type: "string",
                description:
                  'Model to use (optional, default "auto" lets Cursor pick the best model).',
              },
            },
            required: ["prompt"],
          },
          async execute(
            _id: string,
            params: Record<string, unknown>,
          ) {
            const prompt = params.prompt as string;
            
            // Resolve workspace with priority: explicit param > agent context > config default
            const workspace = resolveWorkspace(_id, params, pluginConfig);
            
            const model = (params.model as string) || "auto";
            const args = ["--prompt", prompt, "--model", model];
            if (workspace) args.push("--workspace", workspace);
            const timeout =
              parseInt(pluginConfig.cursorTimeout || "600", 10) * 1000;
            const result = await runPythonScript(cursorScript, args, timeout);
            const data = result.data as Record<string, unknown>;

            const content: Array<{
              type: string;
              text?: string;
            }> = [];

            if (data.output) {
              content.push({ type: "text", text: data.output as string });
            } else if (data.error) {
              content.push({
                type: "text",
                text: `Error: ${data.error as string}`,
              });
            } else {
              content.push({ type: "text", text: result.raw || "No output" });
            }

            // Include created files — OpenClaw gateway auto-detects and routes media files
            // back to the originating platform (Telegram → photo reply, etc.)
            const files = (data.files_created as string[]) || [];
            if (files.length > 0) {
              // List file paths - gateway will detect images and attach them
              const fileList = files.map((f) => `  • ${f}`).join("\n");
              content.push({
                type: "text",
                text: `\n\nGenerated files:\n${fileList}`,
              });
            }

            return { content };
          },
        },
        { optional: true },
      );
      registeredTools.push("cursor_agent_direct");
    } else {
      skippedTools.push(
        `cursor_agent_direct (${!enableCursor ? "disabled" : "script not found"})`,
      );
    }

    // Tool: picoclaw_chat
    const enablePicoClaw = pluginConfig.enablePicoClaw !== "false";
    if (enablePicoClaw && existsSync(picoScript)) {
      api.registerTool(
        {
          name: "picoclaw_chat",
          description:
            "Chat with PicoClaw, an ultra-lightweight AI assistant (https://github.com/sipeed/picoclaw). " +
            "Good for quick questions, web searches, lightweight tasks, and getting a second opinion. " +
            "PicoClaw runs on minimal hardware (<10MB RAM) and supports multiple LLM providers.",
          parameters: {
            type: "object",
            properties: {
              message: {
                type: "string",
                description: "The message to send to PicoClaw.",
              },
            },
            required: ["message"],
          },
          async execute(
            _id: string,
            params: Record<string, unknown>,
          ) {
            const message = params.message as string;
            const result = await runPythonScript(
              picoScript,
              ["chat", "--message", message],
              180000,
            );
            const data = result.data as Record<string, unknown>;
            const response =
              (data.response as string) ||
              (data.error as string) ||
              result.raw ||
              "No response";
            return { content: [{ type: "text", text: response }] };
          },
        },
        { optional: true },
      );
      registeredTools.push("picoclaw_chat");

      // Tool: picoclaw_config
      api.registerTool(
        {
          name: "picoclaw_config",
          description:
            "View or update PicoClaw configuration (model, provider, language, temperature, etc.). " +
            "Use action 'view' to see current config, 'set' to update a field.",
          parameters: {
            type: "object",
            properties: {
              action: {
                type: "string",
                enum: ["view", "set"],
                description:
                  "'view' to see current config, 'set' to update a field.",
              },
              key: {
                type: "string",
                description:
                  "Config key to set (e.g. model, base_url, language, temperature, max_tokens).",
              },
              value: {
                type: "string",
                description: "Value to set for the config key.",
              },
            },
            required: ["action"],
          },
          async execute(
            _id: string,
            params: Record<string, unknown>,
          ) {
            const action = params.action as string;
            if (action === "set") {
              const key = params.key as string;
              const value = params.value as string;
              if (!key || !value) {
                return {
                  content: [
                    {
                      type: "text",
                      text: "Error: both 'key' and 'value' are required for action 'set'",
                    },
                  ],
                };
              }
              const result = await runPythonScript(picoScript, [
                "config-set",
                "--key",
                key,
                "--value",
                value,
              ]);
              const data = result.data as Record<string, unknown>;
              return {
                content: [
                  {
                    type: "text",
                    text: data.ok
                      ? `Updated PicoClaw config: ${key} = ${JSON.stringify(data.new_value)}`
                      : `Error: ${data.error || "failed to update config"}`,
                  },
                ],
              };
            } else {
              // view
              const result = await runPythonScript(picoScript, ["config"]);
              return {
                content: [
                  {
                    type: "text",
                    text: JSON.stringify(result.data, null, 2),
                  },
                ],
              };
            }
          },
        },
        { optional: true },
      );
      registeredTools.push("picoclaw_config");
    } else {
      skippedTools.push(
        `picoclaw_chat, picoclaw_config (${!enablePicoClaw ? "disabled" : "script not found"})`,
      );
    }

    // Tool: team_coordinate
    if (existsSync(teamScript)) {
      api.registerTool(
        {
          name: "team_coordinate",
          description:
            "Manage agent team sessions — create/claim/update tasks on a shared task board, " +
            "send messages to teammates, and check team status. " +
            "Used for multi-agent collaboration in Telegram group chats.",
          parameters: {
            type: "object",
            properties: {
              action: {
                type: "string",
                enum: [
                  "create_task",
                  "claim_task",
                  "update_task",
                  "get_tasks",
                  "message_teammate",
                  "get_messages",
                  "team_status",
                ],
                description: "The team coordination action to perform.",
              },
              team: {
                type: "string",
                description: "Team name (e.g., 'project-alpha').",
              },
              title: {
                type: "string",
                description: "Task title (for create_task).",
              },
              assign_to: {
                type: "string",
                description:
                  "Agent to assign the task to (for create_task). E.g., 'artist', 'assistant', 'developer'.",
              },
              task_id: {
                type: "string",
                description: "Task ID (for claim_task, update_task). E.g., 'T001'.",
              },
              status: {
                type: "string",
                enum: ["todo", "in_progress", "done", "blocked", "cancelled"],
                description: "New task status (for update_task).",
              },
              notes: {
                type: "string",
                description: "Notes to add to the task (for update_task).",
              },
              to: {
                type: "string",
                description:
                  "Recipient agent ID (for message_teammate). E.g., 'artist'.",
              },
              body: {
                type: "string",
                description: "Message body (for message_teammate).",
              },
              agent: {
                type: "string",
                description:
                  "Your agent ID — who you are (for claim_task, message_teammate).",
              },
            },
            required: ["action", "team"],
          },
          async execute(
            _id: string,
            params: Record<string, unknown>,
          ) {
            const action = params.action as string;
            const team = params.team as string;
            let args: string[] = [];

            switch (action) {
              case "create_task":
                args = [
                  "task-add",
                  "--name",
                  team,
                  "--title",
                  (params.title as string) || "Untitled task",
                ];
                if (params.assign_to)
                  args.push("--assign-to", params.assign_to as string);
                break;

              case "claim_task":
                args = [
                  "task-claim",
                  "--name",
                  team,
                  "--task-id",
                  (params.task_id as string) || "",
                  "--agent",
                  (params.agent as string) || "unknown",
                ];
                break;

              case "update_task":
                args = [
                  "task-update",
                  "--name",
                  team,
                  "--task-id",
                  (params.task_id as string) || "",
                ];
                if (params.status)
                  args.push("--status", params.status as string);
                if (params.notes)
                  args.push("--notes", params.notes as string);
                break;

              case "get_tasks":
                args = ["task-list", "--name", team, "--json"];
                break;

              case "message_teammate":
                args = [
                  "message",
                  "--name",
                  team,
                  "--from",
                  (params.agent as string) || "unknown",
                  "--to",
                  (params.to as string) || "unknown",
                  "--body",
                  (params.body as string) || "",
                ];
                break;

              case "get_messages":
                args = ["messages", "--name", team, "--json"];
                break;

              case "team_status":
                args = ["status", "--name", team, "--json"];
                break;

              default:
                return {
                  content: [
                    {
                      type: "text",
                      text: `Unknown action: ${action}`,
                    },
                  ],
                };
            }

            const result = await runPythonScript(teamScript, args);
            const text =
              typeof result.data === "string"
                ? result.data
                : JSON.stringify(result.data, null, 2);
            return {
              content: [{ type: "text", text: result.raw || text }],
            };
          },
        },
        { optional: false },
      );
      registeredTools.push("team_coordinate");
    } else {
      skippedTools.push("team_coordinate (script not found)");
    }

    if (registeredTools.length > 0) {
      api.logger?.info(
        `claw-core: registered tools: ${registeredTools.join(", ")}`,
      );
    }
    if (skippedTools.length > 0) {
      api.logger?.info(
        `claw-core: skipped tools: ${skippedTools.join(", ")}`,
      );
    }
  } else {
    api.logger?.warn(
      "claw-core: api.registerTool not available (OpenClaw version may be too old); tools not registered. Skills still work via exec fallback.",
    );
  }

  api.logger?.info(
    "claw-core plugin loaded (exec: " +
      execScript +
      ", daemon: " +
      daemonScript +
      ", cursor: " +
      cursorScript +
      ", picoclaw: " +
      picoScript +
      ")",
  );
}
