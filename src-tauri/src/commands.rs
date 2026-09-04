use serde::{Deserialize, Serialize};
use std::path::PathBuf;

use crate::pdf_engine;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PdfFileInfo {
    pub path: String,
    pub name: String,
    pub size: u64,
    pub page_count: usize,
}

#[tauri::command]
pub fn pick_pdf_files() -> Result<Vec<PdfFileInfo>, String> {
    let files = rfd::FileDialog::new()
        .add_filter("PDF files", &["pdf"])
        .pick_files();

    let paths = match files {
        Some(p) => p,
        None => return Ok(Vec::new()),
    };

    let mut result = Vec::new();
    for path in paths {
        let path_str = path.to_string_lossy().to_string();
        let name = path
            .file_name()
            .map(|n| n.to_string_lossy().to_string())
            .unwrap_or_else(|| "Unknown.pdf".to_string());

        match pdf_engine::get_pdf_metadata(&path) {
            Ok((page_count, size)) => {
                result.push(PdfFileInfo {
                    path: path_str,
                    name,
                    size,
                    page_count,
                });
            }
            Err(err) => {
                eprintln!("Skipping invalid PDF {:?}: {}", path, err);
            }
        }
    }

    Ok(result)
}

#[tauri::command]
pub fn inspect_pdf_files(paths: Vec<String>) -> Result<Vec<PdfFileInfo>, String> {
    let mut result = Vec::new();

    for path_str in paths {
        let path = PathBuf::from(&path_str);
        if !path.exists() || !path.is_file() {
            continue;
        }

        let name = path
            .file_name()
            .map(|n| n.to_string_lossy().to_string())
            .unwrap_or_else(|| "Unknown.pdf".to_string());

        if let Ok((page_count, size)) = pdf_engine::get_pdf_metadata(&path) {
            result.push(PdfFileInfo {
                path: path_str,
                name,
                size,
                page_count,
            });
        }
    }

    Ok(result)
}

#[tauri::command]
pub fn save_pdf_dialog(default_name: String) -> Result<Option<String>, String> {
    let file = rfd::FileDialog::new()
        .add_filter("PDF files", &["pdf"])
        .set_file_name(&default_name)
        .save_file();

    Ok(file.map(|p| p.to_string_lossy().to_string()))
}

#[tauri::command]
pub fn merge_pdfs(input_paths: Vec<String>, output_path: String) -> Result<String, String> {
    if input_paths.len() < 2 {
        return Err("Please select at least 2 PDF files to merge".to_string());
    }

    let input_path_bufs: Vec<PathBuf> = input_paths.iter().map(PathBuf::from).collect();
    let out_path = PathBuf::from(&output_path);

    pdf_engine::merge_documents(&input_path_bufs, &out_path)?;

    Ok(format!(
        "Successfully merged {} PDF files into {}",
        input_paths.len(),
        output_path
    ))
}

#[tauri::command]
pub fn split_pdf(
    input_path: String,
    page_range: String,
    output_path: String,
) -> Result<String, String> {
    let in_path = PathBuf::from(&input_path);
    if !in_path.exists() {
        return Err(format!("File does not exist: {}", input_path));
    }

    let (total_pages, _) = pdf_engine::get_pdf_metadata(&in_path)?;
    let pages_to_keep = pdf_engine::parse_page_range(&page_range, total_pages)?;

    let out_path = PathBuf::from(&output_path);
    pdf_engine::split_document(&in_path, &pages_to_keep, &out_path)?;

    Ok(format!(
        "Successfully exported {} pages to {}",
        pages_to_keep.len(),
        output_path
    ))
}
