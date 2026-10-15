import { afterEach, describe, expect, it } from '@jest/globals';

import { detectRuntime } from '../../src/utils/runtime.js';

type MutableGlobals = Record<string, unknown>;
type MutableProcess = { execArgv: string[] };

const globals = globalThis as MutableGlobals;
const mutableProcess = process as unknown as MutableProcess;

const originalBun = Object.getOwnPropertyDescriptor(globals, 'Bun');
const originalDeno = Object.getOwnPropertyDescriptor(globals, 'Deno');
const originalNodeOptions = process.env.NODE_OPTIONS;
const originalExecArgv = [...process.execArgv];

function restoreGlobal(key: string, descriptor?: PropertyDescriptor): void {
  if (descriptor) {
    Object.defineProperty(globals, key, descriptor);
  } else {
    delete globals[key];
  }
}

describe('detectRuntime', () => {
  afterEach(() => {
    restoreGlobal('Bun', originalBun);
    restoreGlobal('Deno', originalDeno);
    mutableProcess.execArgv = [...originalExecArgv];
    if (originalNodeOptions === undefined) {
      delete process.env.NODE_OPTIONS;
    } else {
      process.env.NODE_OPTIONS = originalNodeOptions;
    }
  });

  it('detects bun', () => {
    globals.Bun = {};
    expect(detectRuntime()).toBe('bun');
  });

  it('detects deno', () => {
    globals.Deno = {};
    expect(detectRuntime()).toBe('deno');
  });

  it('detects tsx from process.execArgv', () => {
    delete process.env.NODE_OPTIONS;
    mutableProcess.execArgv = ['--import', 'tsx'];
    expect(detectRuntime()).toBe('tsx');
  });

  it('detects tsx from NODE_OPTIONS', () => {
    process.env.NODE_OPTIONS = '--import tsx';
    expect(detectRuntime()).toBe('tsx');
  });

  it('falls back to node', () => {
    delete process.env.NODE_OPTIONS;
    mutableProcess.execArgv = [];
    expect(detectRuntime()).toBe('node');
  });
});
