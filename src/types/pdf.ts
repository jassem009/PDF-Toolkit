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

export type ActiveTab =
  | "merge"
  | "split"
  | "compress"
  | "extract-text"
  | "extract-images"
  | "page-numbers"
  | "organize-pages";

export type CompressionQuality = "low" | "medium" | "high";

export type PageNumberPosition =
  | "top-left"
  | "top-center"
  | "top-right"
  | "bottom-left"
  | "bottom-center"
  | "bottom-right";

export interface PageNumberOptions {
  position: PageNumberPosition;
  font_size: number;
  start_number: number;
  format: string;
  margin?: number;
}

export interface PageNumberResult {
  pages_processed: number;
  output_path: string;
}

export interface PageDetails {
  page_number: number;
  rotation: number;
  width: number;
  height: number;
}

export interface PageItemState {
  id: string; // unique stable identifier
  originalPageNumber: number; // 1-indexed
  additionalRotation: number; // 0, 90, 180, 270 added to existing
  nativeRotation: number; // original rotation in degrees
  width: number;
  height: number;
}

export interface PageOrganizeAction {
  original_page_number: number;
  rotation: number;
}

export interface OrganizePagesResult {
  pages_processed: number;
  output_path: string;
}
