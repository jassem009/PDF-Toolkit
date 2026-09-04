export interface PdfFileInfo {
  path: string;
  name: string;
  size: number;
  page_count: number;
}

export type ActiveTab = "merge" | "split";
