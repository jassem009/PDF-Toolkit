import { invoke } from "@tauri-apps/api/core";
import { LoadFilesResult } from "../types/pdf";

/**
 * Open native OS save dialog for a PDF document.
 */
export async function promptSavePdf(defaultName: string): Promise<string | null> {
  return invoke<string | null>("save_pdf_dialog", { defaultName });
}

/**
 * Open native OS save dialog for a text export file.
 */
export async function promptSaveTxt(defaultName: string): Promise<string | null> {
  return invoke<string | null>("save_txt_dialog", { defaultName });
}

/**
 * Open native OS folder picker dialog.
 */
export async function promptPickFolder(): Promise<string | null> {
  return invoke<string | null>("pick_folder_dialog");
}

/**
 * Open native OS file picker dialog for one or more PDF documents.
 */
export async function promptPickPdfFiles(): Promise<LoadFilesResult> {
  return invoke<LoadFilesResult>("pick_pdf_files");
}
