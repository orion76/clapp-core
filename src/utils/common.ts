export function commandFindDefault(fileName: string) {
  return fileName.endsWith('/definition.ts') || fileName.endsWith('.definition.ts');
}

export function isNotEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0;
}
