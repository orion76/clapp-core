import type { IOrderedListData, IOrderedListItem, TListMarker } from '@clapp/command';

import { bold, dim, dimStruck, green } from '../styling';

const BULLET = '•';

function normalize(item: string | IOrderedListItem): IOrderedListItem {
  return typeof item === 'string' ? { text: item } : item;
}

/**
 * Builds the marker of an item. Numbers are padded to the widest ordinal so
 * that the item texts stay aligned.
 * @param index Zero-based item index
 * @param width Width of the highest ordinal
 * @param marker Marker style
 * @returns Item marker
 */
function markerText(index: number, width: number, marker: TListMarker): string {
  return marker === 'bullet' ? BULLET : `${String(index + 1).padStart(width)}.`;
}

/**
 * Builds the completion box of an item. The flag is visible without color
 * support, the styling only reinforces it.
 * @param done Completion flag
 * @returns Completion box
 */
function checkbox(done: boolean): string {
  return done ? green('[x]') : dim('[ ]');
}

/**
 * Renders the title and the description of the list.
 * @param data List data
 * @returns Header lines
 */
function renderHeader(data: IOrderedListData): string[] {
  const lines: string[] = [];
  if (data.title?.trim()) {
    lines.push(bold(data.title));
  }
  if (data.description?.trim()) {
    lines.push(dim(data.description));
  }

  return lines;
}

/**
 * Renders a list of items as a numbered or bulleted list. Items marked as done
 * get a checked box and struck-through text. Empty input renders as an empty
 * string instead of failing.
 * @param data List data
 * @returns List ready for the terminal
 */
export function renderOrderedList(data: IOrderedListData = {}): string {
  const header = renderHeader(data);
  const items = (Array.isArray(data.items) ? data.items : []).map(normalize);
  const ordinalWidth = String(items.length).length;
  const marker = data.marker ?? 'number';

  const lines = items.map((item, index) => {
    const text = item.done ? dimStruck(item.text) : item.text;

    return `${markerText(index, ordinalWidth, marker)} ${checkbox(item.done === true)} ${text}`;
  });

  if (header.length > 0 && lines.length > 0) {
    return [...header, '', ...lines].join('\n');
  }

  return [...header, ...lines].join('\n');
}
