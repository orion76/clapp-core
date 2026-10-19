import { describe, expect, it } from '@jest/globals';

import { getPluginDefinition } from '@orion76/node-plugin';

import type { IKeyValueData } from '@clapp/command';

import { renderKeyValue } from '../../src/plugins/formatters/key-value/lib.js';
import { KeyValueFormatterPlugin } from '../../src/plugins/formatters/key-value/key-value.plugin.js';

/**
 * Removes the ANSI style codes emitted by `@opentf/cli-styles`, so assertions
 * compare plain text.
 * @param text Styled text
 * @returns Text without style codes
 */
function plain(text: string): string {
  return text.replace(/\u001b\[[0-9;]*m/g, '');
}

const PAIRS: IKeyValueData = {
  title: 'Initialized opencode artifacts in /work',
  pairs: [
    { key: 'config', value: '/work/opencode.json (created)' },
    { key: 'file', value: '/work/AGENTS.md (existing)' },
  ],
};

describe('renderKeyValue', () => {
  it('renders the title above the aligned pairs', () => {
    expect(plain(renderKeyValue(PAIRS)).split('\n')).toEqual([
      'Initialized opencode artifacts in /work',
      'config  /work/opencode.json (created)',
      'file    /work/AGENTS.md (existing)',
    ]);
  });

  it('renders the description under the title', () => {
    const data: IKeyValueData = { title: 'Summary', description: 'package fields', pairs: [{ key: 'name', value: 'x' }] };

    expect(plain(renderKeyValue(data)).split('\n')).toEqual(['Summary', 'package fields', 'name  x']);
  });

  it('pads keys to the widest key of their block only', () => {
    const data: IKeyValueData = {
      pairs: [{ key: 'a', value: '1' }],
      sections: [{ title: 'wide', pairs: [{ key: 'long-key', value: '2' }] }],
    };

    expect(plain(renderKeyValue(data))).toBe(['a  1', '', 'wide', 'long-key  2'].join('\n'));
  });

  it('renders a pair without a value as a lone key without trailing spaces', () => {
    const data: IKeyValueData = { pairs: [{ key: 'withValue', value: 'v' }, { key: 'noValue' }] };

    expect(plain(renderKeyValue(data)).split('\n')).toEqual(['withValue  v', 'noValue']);
  });

  it('separates sections with a blank line and keeps section titles', () => {
    const data: IKeyValueData = {
      sections: [
        { title: 'dependencies (2)', pairs: [{ key: 'one', value: '1' }, { key: 'two', value: '2' }] },
        { title: 'scripts (1)', pairs: [{ key: 'build', value: 'tsc' }] },
      ],
    };

    expect(plain(renderKeyValue(data))).toBe(
      ['dependencies (2)', 'one  1', 'two  2', '', 'scripts (1)', 'build  tsc'].join('\n'),
    );
  });

  it('renders pairs of a section without a title', () => {
    expect(plain(renderKeyValue({ sections: [{ pairs: [{ key: 'k', value: 'v' }] }] }))).toBe('k  v');
  });

  it('renders an empty string for empty input', () => {
    expect(renderKeyValue()).toBe('');
    expect(renderKeyValue({})).toBe('');
    expect(renderKeyValue({ pairs: [], sections: [] })).toBe('');
    expect(renderKeyValue({ title: '   ', pairs: [] })).toBe('');
  });

  it('skips a section that has neither title nor pairs', () => {
    const data: IKeyValueData = { pairs: [{ key: 'only', value: 'here' }], sections: [{}] };

    expect(plain(renderKeyValue(data))).toBe('only  here');
  });
});

describe('KeyValueFormatterPlugin', () => {
  it('declares the key-value kind and id', () => {
    expect(getPluginDefinition(KeyValueFormatterPlugin)).toMatchObject({ id: 'key-value', kind: 'key-value' });
  });

  it('formats the given data', async () => {
    const plugin = new KeyValueFormatterPlugin();
    const output = await plugin.format({ pairs: [{ key: 'k', value: 'v' }] });

    expect(plain(output)).toBe('k  v');
  });
});
