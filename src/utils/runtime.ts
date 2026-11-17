import process from 'node:process';

import type { TAppRuntime } from '@clapp/common';

/**
 * Whether a single node CLI option asks for the `tsx` TypeScript runner: it is
 * registered either as the bare marker `tsx`, as `--import=tsx`, or as a path
 * into the package of the runner.
 * @param value One entry of `process.execArgv` or of `NODE_OPTIONS`
 * @returns `true` when the entry registers the `tsx` loader
 */
function isTsxOption(value: string): boolean {
  return value === 'tsx' || value.endsWith('=tsx') || value.startsWith('tsx/') || value.includes('/tsx/');
}

/**
 * Detects the runtime the application is running under. Bun and Deno expose
 * distinct globals; `tsx` is a Node.js loader and registers itself through
 * `process.execArgv` or `NODE_OPTIONS`; everything else is plain Node.js.
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

  const nodeOptions = process.env.NODE_OPTIONS ?? '';
  const usesTsx = [...process.execArgv, ...nodeOptions.split(/\s+/)].some(isTsxOption);

  return usesTsx ? 'tsx' : 'node';
}
