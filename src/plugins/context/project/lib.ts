import { getProjectRoot } from "@clapp/utils";
import { readFileSync } from "fs";
import path from "path";

/**
 * Root of the context project, or `null` when there is none.
 *
 * The rule is the one of the `app-root` context (`getProjectRoot` of
 * `@clapp/utils`), but a failure is not fatal here: a working directory outside
 * the searched tree or a missing project only makes the context empty.
 *
 * @param cwd Working directory the lookup starts from
 * @param userHome Directory the lookup is bounded by
 * @returns Root of the context project, or `null`
 */
export function resolveProjectRoot(cwd: string, userHome: string): string | null {
  try {
    return getProjectRoot(cwd, userHome);
  } catch {
    return null;
  }
}

/**
 * Reads the `name` of the `package.json` of the given project root.
 *
 * @param projectRoot Root of the context project
 * @returns Package name, or an empty string when the file is unreadable or has no `name`
 */
export function readProjectName(projectRoot: string): string {
  try {
    const contents = readFileSync(path.join(projectRoot, 'package.json'), 'utf8');
    const packageJson = JSON.parse(contents) as { name?: unknown };
    const name = packageJson.name;

    return typeof name === 'string' ? name : '';
  } catch {
    return '';
  }
}
