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

export interface CompressResult {
  original_size: number;
  compressed_size: number;
  bytes_saved: number;
  percentage_saved: number;
  images_compressed: number;
  output_path: string;
}

export type ActiveTab = "merge" | "split" | "compress";
export type CompressionQuality = "low" | "medium" | "high";
