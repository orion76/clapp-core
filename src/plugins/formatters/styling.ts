import { style } from '@opentf/cli-styles';

/**
 * Escapes the characters `@opentf/cli-styles` treats as markup, so that text
 * coming from the caller is rendered literally inside a styled block.
 * Inside a style group the library consumes a backslash and the next character
 * as an escape sequence, which covers both reserved characters.
 * @param text Text to escape
 * @returns Text safe to embed into a style group
 */
function escapeMarkup(text: string): string {
  return text.replaceAll('\\', '\\\\').replaceAll('$', '\\$');
}

/**
 * Wraps text into a `@opentf/cli-styles` style group. Color support is detected
 * by the library (it respects `NO_COLOR` / `FORCE_COLOR`), so the same call
 * yields plain text on a terminal without color support.
 * @param codes Style codes, for example `bol` or `dim.str`
 * @param text Text to style
 * @returns Styled text
 */
function styled(codes: string, text: string): string {
  return style(`$${codes}{${escapeMarkup(text)}}`);
}

/**
 * Renders text in bold.
 * @param text Text to style
 * @returns Styled text
 */
export function bold(text: string): string {
  return styled('bol', text);
}

/**
 * Renders text dimmed.
 * @param text Text to style
 * @returns Styled text
 */
export function dim(text: string): string {
  return styled('dim', text);
}

/**
 * Renders text in green.
 * @param text Text to style
 * @returns Styled text
 */
export function green(text: string): string {
  return styled('g', text);
}

/**
 * Renders text dimmed and struck through.
 * @param text Text to style
 * @returns Styled text
 */
export function dimStruck(text: string): string {
  return styled('dim.str', text);
}
