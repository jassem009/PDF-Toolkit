/**
 * Evaluates a page number format template on the client for live preview.
 * Supports presets like "Page X of Y", "X", "Page X", "X / Y", "- X -",
 * as well as template tags like {page} and {total}.
 */
export function evaluatePageNumberFormat(
  template: string,
  currentPage: number,
  totalPages: number
): string {
  const trimmed = template.trim();
  if (!trimmed) {
    return String(currentPage);
  }

  let res = trimmed;

  // Replace explicit token placeholders
  res = res.replace(/\{page\}|\{PAGE\}|\{p\}|\{n\}/g, String(currentPage));
  res = res.replace(/\{total\}|\{TOTAL\}|\{count\}/g, String(totalPages));

  // Replace standalone 'X' or 'x' (case-insensitive boundary match)
  res = res.replace(/(^|[^a-zA-Z0-9])X([^a-zA-Z0-9]|$)/g, `$1${currentPage}$2`);
  res = res.replace(/(^|[^a-zA-Z0-9])x([^a-zA-Z0-9]|$)/g, `$1${currentPage}$2`);
  res = res.replace(/(^|[^a-zA-Z0-9])Y([^a-zA-Z0-9]|$)/g, `$1${totalPages}$2`);
  res = res.replace(/(^|[^a-zA-Z0-9])y([^a-zA-Z0-9]|$)/g, `$1${totalPages}$2`);

  return res;
}
