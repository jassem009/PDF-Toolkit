export interface PdfFileInfo {
  path: string;
  name: string;
  size: number;
  page_count: number;
}

export interface LoadFilesResult {
  files: PdfFileInfo[];
  errors: string[];
}

export type ActiveTab = "merge" | "split";
