#!/usr/bin/env node
import 'reflect-metadata';

import { resolve } from 'node:path';

import { Container } from 'inversify';

import { run } from '../bootstrap';
import { APP_CONFIG_PATH_DEFAULT } from '../constants/paths';
import { MCPEngine } from '../engines/mcp/mcp';

/**
 * Root of the application the server exposes.
 *
 * The bin runs inside the host project, so the application root is where the process was
 * started; `CLAPP_APP_ROOT` overrides it for a launcher that starts the process elsewhere.
 */
const appRoot = process.env.CLAPP_APP_ROOT ?? process.cwd();

/**
 * Path of the application config.
 *
 * `APP_CONFIG_PATH_DEFAULT` is resolved against the application root, so a project keeps
 * its own config no matter which directory the process was started from;
 * `CLAPP_CONFIG_PATH` overrides the path.
 */
const configPath = process.env.CLAPP_CONFIG_PATH ?? resolve(appRoot, APP_CONFIG_PATH_DEFAULT);

const container = new Container();

/**
 * Starts the project as an MCP server over the stdio transport.
 *
 * The mode is a separate executable rather than a subcommand of the CLI: the engine is
 * chosen here, at the entry point, and handed to `run` — exactly as a CLI entry point
 * chooses `CliEngine`. Nothing is printed here either: under the stdio transport stdout
 * carries the protocol stream, so the engine is the only writer, and only to stderr.
 */
await run(MCPEngine, container, { appRoot, configPath });
