/**
 * Boot hook: start claw_core daemon on gateway:startup
 */
/// <reference types="node" />
import { spawn } from "child_process";
import { existsSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const HOOK_DIR = __dirname;
const PLUGIN_ROOT = join(HOOK_DIR, "..", "..");
const DAEMON_SCRIPT = join(PLUGIN_ROOT, "scripts", "claw_core_daemon.sh");

export default async function bootClawCore(event: {
  type?: string;
  action?: string;
  context?: { cfg?: { plugins?: { entries?: Record<string, { config?: Record<string, unknown> }> } } };
}) {
  if (event.type !== "gateway" || event.action !== "startup") return;

  const cfg = event.context?.cfg?.plugins?.entries?.["claw-core"]?.config ?? {};
  const autoStart = cfg.autoStart !== false;
  if (!autoStart) return;

  if (!existsSync(DAEMON_SCRIPT)) {
    console.warn("[boot-claw-core] daemon script not found:", DAEMON_SCRIPT);
    return;
  }

  const env: Record<string, string> = { ...process.env, CLAW_CORE_PLUGIN_ROOT: PLUGIN_ROOT };
  if (cfg.binaryPath) env.CLAW_CORE_BINARY = String(cfg.binaryPath);
  if (cfg.socketPath) env.CLAW_CORE_SOCKET = String(cfg.socketPath);
  if (cfg.sourcePath) env.CLAW_CORE_SOURCE = String(cfg.sourcePath);

  spawn("bash", [DAEMON_SCRIPT, "start"], {
    env,
    stdio: "ignore",
    detached: true,
  }).unref();
}
