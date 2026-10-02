import { isFileInside } from '@clapp/utils';

export function getStartDirectories(projects: string[]): string[] {
  return getRootDirectoies(projects);
}
function getRootDirectoies(paths: string[]): string[] {
  if (paths.length === 0) {
    return [];
  }

  const uniquePaths = [...new Set(paths)];

  const rootPaths = uniquePaths.filter((path1) => {
    return !uniquePaths.some((path2) => {
      return path1 !== path2 && isFileInside(path2, path1);
    });
  });

  return rootPaths;
}
