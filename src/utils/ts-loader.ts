/**
 * Runtime TypeScript loader for third-party plugins.
 *
 * Plugins may be shipped as `.ts`/`.tsx`/`.mts`/`.cts` files. Node cannot execute them natively
 * (with type-only imports), so we register the `tsx` loader on demand. The loader is registered
 * lazily and only once per process; JS-only applications never pay for it.
 */
let registration: Promise<void> | undefined;

export function ensureTsLoader(): Promise<void> {
  if (!registration) {
    registration = (async () => {
      try {
        const { register } = await import('tsx/esm/api');
        register();
      } catch (error) {
        registration = undefined;
        throw new Error(
          'Loading TypeScript plugins requires the "tsx" package. Install it, or ship plugins as compiled JavaScript.',
          { cause: error },
        );
      }
    })();
  }

  return registration;
}
