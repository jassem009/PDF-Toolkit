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

export interface ExtractTextResult {
  pages_processed: number;
  characters_extracted: number;
  output_path: string;
  is_scanned: boolean;
}

export interface ExtractImagesResult {
  pages_processed: number;
  images_found: number;
  output_folder: string;
  extracted_files: string[];
}

export type ActiveTab = "merge" | "split" | "compress" | "extract-text" | "extract-images";
export type CompressionQuality = "low" | "medium" | "high";
