/**
 * OpenClaw plugin: Claw Core — Terminal Runtime Layer integration
 * Auto-starts claw_core daemon, provides skills and CLI.
 */
import { spawn } from "child_process";
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

export default function register(api: {
  registerPluginHooksFromDir?: (api: object, dir: string) => void;
  registerCli: (fn: (opts: { program: { command: (name: string) => { description: (d: string) => { action: (fn: (arg?: string) => void) => void } } } }) => void, opts?: { commands: string[] }) => void;
  registerGatewayMethod: (name: string, handler: (opts: { respond: (ok: boolean, data: unknown) => void }) => void) => void;
  logger?: { info: (msg: string) => void; warn: (msg: string) => void };
}) {
  // Register boot hook (API or SDK may provide registerPluginHooksFromDir)
  const registerHooks = api.registerPluginHooksFromDir ?? sdkRegisterHooks;
  if (typeof registerHooks === "function") {
    registerHooks(api, join(PLUGIN_ROOT, "hooks"));
  } else {
    api.logger?.warn("claw-core: registerPluginHooksFromDir not available; boot hook may not load. Start daemon manually: openclaw clawcore start");
  }
  const daemonScript = getDaemonScript();
  const execScript = getExecScript();

  // CLI: openclaw clawcore start|stop|restart|status|setup-cursor|teardown
  api.registerCli(
    ({ program }) => {
      const cmd = program
        .command("clawcore <action>")
        .description("Manage claw_core daemon (start|stop|restart|status|setup-cursor|teardown)");

      cmd.action((action?: string) => {
        const act = action ?? "status";

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
          const setupScript = join(PLUGIN_ROOT, "scripts", "setup-cursor-integration.js");
          if (!existsSync(setupScript)) {
            console.error("Cursor setup script not found:", setupScript);
            process.exit(1);
          }
          const env = { ...process.env } as Record<string, string>;
          // Forward --workspace arg if present
          const wsIdx = process.argv.indexOf("--workspace");
          const args = ["node", setupScript];
          if (wsIdx !== -1 && process.argv[wsIdx + 1]) {
            args.push("--workspace", process.argv[wsIdx + 1]);
          }
          const child = spawn(args[0], args.slice(1), { env, stdio: "inherit" });
          child.on("close", (code) => process.exit(code ?? 0));
          return;
        }

        if (!existsSync(daemonScript)) {
          console.error("claw_core daemon script not found:", daemonScript);
          process.exit(1);
        }
        const env: Record<string, string> = { ...process.env, CLAW_CORE_PLUGIN_ROOT: PLUGIN_ROOT };
        const cfg = (api as { config?: { plugins?: { entries?: Record<string, { config?: Record<string, string> }> } } }).config?.plugins?.entries?.["claw-core"]?.config ?? {};
        if (cfg.binaryPath) env.CLAW_CORE_BINARY = cfg.binaryPath;
        if (cfg.socketPath) env.CLAW_CORE_SOCKET = cfg.socketPath;
        if (cfg.sourcePath) env.CLAW_CORE_SOURCE = cfg.sourcePath;

        const child = spawn("bash", [daemonScript, act], {
          env,
          stdio: "inherit",
        });
        child.on("close", (code) => process.exit(code ?? 0));
      });
    },
    { commands: ["clawcore"] }
  );

  // Gateway RPC: clawcore.status
  api.registerGatewayMethod("clawcore.status", ({ respond }) => {
    if (!existsSync(daemonScript)) {
      respond(false, { error: "daemon script not found" });
      return;
    }
    const env: Record<string, string> = { ...process.env, CLAW_CORE_PLUGIN_ROOT: PLUGIN_ROOT };
    const cfg = (api as { config?: { plugins?: { entries?: Record<string, { config?: Record<string, string> }> } } }).config?.plugins?.entries?.["claw-core"]?.config ?? {};
    if (cfg.socketPath) env.CLAW_CORE_SOCKET = cfg.socketPath;

    const child = spawn("bash", [daemonScript, "status"], {
      env,
    });
    let stdout = "";
    let stderr = "";
    child.stdout?.on("data", (d) => (stdout += d));
    child.stderr?.on("data", (d) => (stderr += d));
    child.on("close", (code) => {
      const running = stdout.includes("✓") && !stdout.includes("✗ claw_core not running");
      respond(true, { running, code, stdout: stdout.trim(), stderr: stderr.trim() });
    });
  });

  api.logger?.info("claw-core plugin loaded (exec: " + execScript + ", daemon: " + daemonScript + ")");
}
