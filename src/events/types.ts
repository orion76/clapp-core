/**
 * Internal erased listener type used for storage. Concrete listeners are cast to
 * it because the registry does not need to keep the per-hook argument typing.
 */
export type TAnyHookListener = (...args: unknown[]) => unknown;
