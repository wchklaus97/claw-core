/**
 * OpenClaw plugin: Claw Core — Terminal Runtime Layer integration
 *
 * Features:
 * - Auto-starts claw_core daemon, provides skills and CLI
 * - Agent tools: cursor_agent_direct, picoclaw_chat, picoclaw_config
 * - Multi-bot setup: 3 specialized Telegram bots (artist, assistant, developer)
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

  // ---------------------------------------------------------------
  // CLI: openclaw clawcore start|stop|restart|status|setup-cursor|init-workspace|reset-workspace|teardown|setup-bots
  // ---------------------------------------------------------------
  api.registerCli(
    ({ program }) => {
      const cmd = program
        .command("clawcore <action>")
        .description(
          "Manage claw_core daemon, workspace, and multi-bot setup (start|stop|restart|status|setup-cursor|init-workspace|reset-workspace|teardown|setup-bots)",
        );

      cmd.action((action?: string) => {
        const act = action ?? "status";

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

      cmd.action((action?: string, message?: string) => {
        if (!existsSync(picoScript)) {
          console.error("picoclaw_client.py not found:", picoScript);
          process.exit(1);
        }
        const act = action ?? "status";
        const args: string[] = [picoScript, act];
        if (act === "chat" && message) {
          args.push("--message", message);
        }
        const child = spawn("python3", args, {
          env: { ...process.env, CLAW_CORE_PLUGIN_ROOT: PLUGIN_ROOT },
          stdio: "inherit",
        });
        child.on("close", (code) => process.exit(code ?? 0));
      });
    },
    { commands: ["picoclaw"] },
  );

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
            const workspace = (params.workspace as string) || "";
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

            // Note any created files
            const files = (data.files_created as string[]) || [];
            if (files.length > 0) {
              content.push({
                type: "text",
                text: `\nFiles created:\n${files.map((f) => `  • ${f}`).join("\n")}`,
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
