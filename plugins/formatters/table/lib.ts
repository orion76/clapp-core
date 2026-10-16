import type { ITableData, TTableCell, TTableRecordRow, TTableRow } from '@clapp/command';

import { bold, dim } from '../styling';

const DEFAULT_GAP = 2;
const HEADER_SEPARATOR = '─';

type TStyleFn = (text: string) => string;

function isRecordRow(row: TTableRow | TTableRecordRow): row is TTableRecordRow {
  return !Array.isArray(row);
}

function cellText(value: TTableCell): string {
  return value === null || value === undefined ? '' : String(value);
}

/**
 * Collects the headers of object rows in first-seen order.
 * @param rows Table rows
 * @returns Header names contributed by the rows
 */
function collectHeaders(rows: (TTableRow | TTableRecordRow)[]): string[] {
  const headers: string[] = [];
  for (const row of rows) {
    if (!isRecordRow(row)) {
      continue;
    }
    for (const key of Object.keys(row)) {
      if (!headers.includes(key)) {
        headers.push(key);
      }
    }
  }

  return headers;
}

/**
 * Converts one row into cells ordered like the headers. Array rows keep their
 * own order, object rows are projected onto the headers.
 * @param row Table row
 * @param headers Resolved headers
 * @returns Row cells
 */
function rowCells(row: TTableRow | TTableRecordRow, headers: string[]): string[] {
  if (!isRecordRow(row)) {
    return row.map(cellText);
  }

  const keys = headers.length > 0 ? headers : Object.keys(row);

  return keys.map((key) => cellText(row[key]));
}

/**
 * Renders a single line: cells are padded to the column widths and joined by
 * the gap. The last cell is not padded to avoid trailing whitespace.
 * @param cells Line cells
 * @param widths Column widths
 * @param gap Gap between columns
 * @param style Optional style applied to every padded cell
 * @returns Rendered line
 */
function formatLine(cells: string[], widths: number[], gap: string, style?: TStyleFn): string {
  return widths
    .map((width, index) => {
      const cell = cells[index] ?? '';
      const padded = index === widths.length - 1 ? cell : cell.padEnd(width);

      return style ? style(padded) : padded;
    })
    .join(gap);
}

/**
 * Renders tabular data as a column-aligned table. Headers are bold, the line
 * under them is dim; everything else is plain text. Empty input renders as an
 * empty string instead of failing.
 * @param data Table data
 * @returns Table ready for the terminal
 */
export function renderTable(data: ITableData = {}): string {
  const rows = Array.isArray(data.rows) ? data.rows : [];
  if (rows.length === 0) {
    return '';
  }

  const headers = data.headers && data.headers.length > 0 ? data.headers : collectHeaders(rows);
  const bodies = rows.map((row) => rowCells(row, headers));

  const columnCount = bodies.reduce((max, cells) => Math.max(max, cells.length), headers.length);
  const widths = Array.from({ length: columnCount }, (_, index) =>
    bodies.reduce((max, cells) => Math.max(max, cells[index]?.length ?? 0), headers[index]?.length ?? 0),
  );

  const gap = ' '.repeat(Math.max(0, data.gap ?? DEFAULT_GAP));
  const lines: string[] = [];

  if (headers.length > 0) {
    const separators = widths.map((width) => HEADER_SEPARATOR.repeat(width));
    lines.push(formatLine(headers, widths, gap, bold));
    lines.push(formatLine(separators, widths, gap, dim));
  }

  for (const cells of bodies) {
    lines.push(formatLine(cells, widths, gap));
  }

  return lines.join('\n');
}
