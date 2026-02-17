export function commandFindDefault(fileName: string) {
    return fileName.endsWith('/definition.ts') || fileName.endsWith('.definition.ts');
}