import { TAppRuntime } from "../types";


/**
 * Detects the runtime the application is running under.
 *
 * Bun and Deno expose distinct globals. The `tsx` TypeScript runner registers
 * itself through `process.execArgv` (or `NODE_OPTIONS`), so its presence is
 * detected there. Everything else is treated as plain Node.js.
 * @returns Detected runtime
 */
export function detectRuntime(): TAppRuntime {
  const globals = globalThis as { Bun?: unknown; Deno?: unknown };
  if (globals.Bun !== undefined) {
    return 'bun';
  }
  if (globals.Deno !== undefined) {
    return 'deno';
  }

  const { execArgv = [], env } = globalThis.process;
  const nodeOptions = env?.NODE_OPTIONS ?? '';
  const usesTsx = [...execArgv, nodeOptions].some((value) => value.includes('tsx'));

  return usesTsx ? 'tsx' : 'node';
}
