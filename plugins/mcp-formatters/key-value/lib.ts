import type { IKeyValueData, IKeyValuePair, IKeyValueSection } from '@clapp/command';

/** Spaces between the key column and the value column. */
const VALUE_GAP = 2;

function hasPairs(pairs?: IKeyValuePair[]): pairs is IKeyValuePair[] {
  return Array.isArray(pairs) && pairs.length > 0;
}

/**
 * Renders one pair: the key is padded to the widest key of its block so that the
 * values stay aligned, and a pair without a value renders as a lone key (no
 * trailing whitespace).
 * @param pair Pair to render
 * @param width Width of the widest key in the block
 * @returns Rendered line
 */
function pairText(pair: IKeyValuePair, width: number): string {
  if (pair.value === undefined || pair.value === null) {
    return pair.key;
  }

  return `${pair.key}${' '.repeat(Math.max(0, width - pair.key.length))}${' '.repeat(VALUE_GAP)}${String(pair.value)}`;
}

/**
 * Renders a block of pairs with a shared key column.
 * @param pairs Pairs of the block
 * @returns Rendered lines
 */
function renderPairs(pairs: IKeyValuePair[]): string[] {
  const width = pairs.reduce((max, pair) => Math.max(max, pair.key.length), 0);

  return pairs.map((pair) => pairText(pair, width));
}

/**
 * Renders one section: its title and its pairs.
 * @param section Section to render
 * @returns Rendered lines; empty when the section has neither title nor pairs
 */
function renderSection(section: IKeyValueSection): string[] {
  const lines: string[] = [];
  if (section.title?.trim()) {
    lines.push(section.title);
  }
  if (hasPairs(section.pairs)) {
    lines.push(...renderPairs(section.pairs));
  }

  return lines;
}

/**
 * Renders field data as aligned `key  value` pairs grouped into titled sections
 * for the protocol stream. No styling is applied: the title and the section
 * titles are plain text; keys are padded per block so that their values line up.
 * Empty input renders as an empty string instead of failing.
 * @param data Key-value data
 * @returns Blocks ready for the protocol stream
 */
export function renderKeyValue(data: IKeyValueData = {}): string {
  const blocks: string[][] = [];

  const header: string[] = [];
  if (data.title?.trim()) {
    header.push(data.title);
  }
  if (data.description?.trim()) {
    header.push(data.description);
  }
  if (hasPairs(data.pairs)) {
    header.push(...renderPairs(data.pairs));
  }
  if (header.length > 0) {
    blocks.push(header);
  }

  for (const section of Array.isArray(data.sections) ? data.sections : []) {
    const lines = renderSection(section);
    if (lines.length > 0) {
      blocks.push(lines);
    }
  }

  return blocks.map((block) => block.join('\n')).join('\n\n');
}
