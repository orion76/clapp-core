import { readFileSync } from "fs";
import path from "path";


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
