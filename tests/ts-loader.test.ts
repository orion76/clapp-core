import { ensureTsLoader } from '../src/utils/ts-loader.js';

describe('ensureTsLoader', () => {
  it('memoizes the registration promise', () => {
    expect(ensureTsLoader()).toBe(ensureTsLoader());
  });

  it('resolves after registering the tsx loader', async () => {
    await expect(ensureTsLoader()).resolves.toBeUndefined();
  });
});
