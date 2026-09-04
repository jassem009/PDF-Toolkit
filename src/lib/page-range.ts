export interface PageRangeResult {
  valid: boolean;
  pages: number[];
  error?: string;
}

export function parsePageRangeClient(rangeStr: string, totalPages: number): PageRangeResult {
  const trimmed = rangeStr.trim();
  if (!trimmed) {
    return { valid: false, pages: [], error: "Enter a page range (e.g. 1-5)" };
  }

  const pagesSet = new Set<number>();
  const parts = trimmed.split(",");

  for (const part of parts) {
    const token = part.trim();
    if (!token) continue;

    if (token.includes("-")) {
      const [startStr, endStr] = token.split("-").map((s) => s.trim());
      const start = parseInt(startStr, 10);
      const end = parseInt(endStr, 10);

      if (isNaN(start) || isNaN(end)) {
        return { valid: false, pages: [], error: `Invalid page numbers in range "${token}"` };
      }
      if (start < 1 || end < 1) {
        return { valid: false, pages: [], error: "Page numbers must be 1 or greater" };
      }
      if (start > end) {
        return { valid: false, pages: [], error: `Start page (${start}) cannot exceed end page (${end})` };
      }
      if (end > totalPages) {
        return { valid: false, pages: [], error: `Page ${end} exceeds total pages (${totalPages})` };
      }

      for (let i = start; i <= end; i++) {
        pagesSet.add(i);
      }
    } else {
      const page = parseInt(token, 10);
      if (isNaN(page)) {
        return { valid: false, pages: [], error: `Invalid page number "${token}"` };
      }
      if (page < 1) {
        return { valid: false, pages: [], error: "Page numbers must be 1 or greater" };
      }
      if (page > totalPages) {
        return { valid: false, pages: [], error: `Page ${page} exceeds total pages (${totalPages})` };
      }
      pagesSet.add(page);
    }
  }

  if (pagesSet.size === 0) {
    return { valid: false, pages: [], error: "No valid pages specified" };
  }

  const pages = Array.from(pagesSet).sort((a, b) => a - b);
  return { valid: true, pages };
}
