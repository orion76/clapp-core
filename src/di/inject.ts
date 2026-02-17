import { IProvideClass, IProvideFactory, IProvider, IProvideValue, UProvider } from './types';

const _providers = new Map<string, UProvider>();
const _instances = new Map<string, unknown>();

export function provide(provider: UProvider) {
    _providers.set(provider.provide, provider);
}
function isProviderClass<T extends unknown = unknown>(provider: any): provider is IProvideClass<T> {
    return provider.useClass !== undefined;
}
function isProviderFactory<T extends unknown = unknown>(provider: any): provider is IProvideFactory<T> {
    return provider.useFactory !== undefined;
}
function isProviderValue<T extends unknown = unknown>(provider: any): provider is IProvideValue<T> {
    return provider.useValue !== undefined;
}
function injectDeps(deps: string[] | undefined) {
    return deps ? deps.map((token) => inject(token)) : [];
}
export function inject<T>(token: string): T {
    if (!_instances.has(token)) {
        if (!_providers.has(token)) {
            throw new Error(`Provider for injection token: ${token} not found.`);
        }

        const provider = _providers.get(token)!;
        if (isProviderClass(provider)) {
            const deps = injectDeps(provider.deps);
            _instances.set(token, new provider.useClass(deps));
        } else if (isProviderValue(provider)) {
            _instances.set(token, provider.useValue);
        } else if (isProviderFactory(provider)) {
            const deps = injectDeps(provider.deps);
            _instances.set(token, provider.useFactory(deps));
        } else {
            throw new Error(`Provider with token: "${token}" not found.`);
        }
    }
    return _instances.get(token) as T;
}
