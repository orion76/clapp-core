import { isFileInside } from '@clapp/utils';

export function getStartDirectories(projects: string[]): string[] {
  return getRootDirectoies(projects);
}
function getRootDirectoies(paths: string[]): string[] {
  if (paths.length <= 1) {
    return paths;
  }
  const uniquePaths = [...new Set(paths)];
  // const rootPaths = uniquePaths.filter(isUniquePath(uniquePaths));
  // return rootPaths;
  return uniquePaths.filter(isUniquePath(uniquePaths));
}
function isUniquePath(paths: string[]) {
  return (path1: string) => {
    return !paths.some((path2) => path1 !== path2 && isFileInside(path2, path1));
  };
}
