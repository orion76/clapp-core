import type { IOrderedListData, IOrderedListItem, TListMarker } from '@clapp/common';

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
 * Builds the completion box of an item.
 * @param done Completion flag
 * @returns Completion box
 */
function checkbox(done: boolean): string {
  return done ? '[x]' : '[ ]';
}

/**
 * Renders the title and the description of the list.
 * @param data List data
 * @returns Header lines
 */
function renderHeader(data: IOrderedListData): string[] {
  const lines: string[] = [];
  if (data.title?.trim()) {
    lines.push(data.title);
  }
  if (data.description?.trim()) {
    lines.push(data.description);
  }

  return lines;
}

/**
 * Renders a list of items as a numbered or bulleted list for the protocol
 * stream. Items marked as done get a checked box; no styling is applied, so the
 * completion flag is carried by the box alone. Empty input renders as an empty
 * string instead of failing.
 * @param data List data
 * @returns List ready for the protocol stream
 */
export function renderOrderedList(data: IOrderedListData = {}): string {
  const header = renderHeader(data);
  const items = (Array.isArray(data.items) ? data.items : []).map(normalize);
  const ordinalWidth = String(items.length).length;
  const marker = data.marker ?? 'number';

  const lines = items.map((item, index) => `${markerText(index, ordinalWidth, marker)} ${checkbox(item.done === true)} ${item.text}`);

  if (header.length > 0 && lines.length > 0) {
    return [...header, '', ...lines].join('\n');
  }

  return [...header, ...lines].join('\n');
}
