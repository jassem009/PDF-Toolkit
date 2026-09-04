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

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LoadFilesResult {
    pub files: Vec<PdfFileInfo>,
    pub errors: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CompressResult {
    pub original_size: u64,
    pub compressed_size: u64,
    pub bytes_saved: u64,
    pub percentage_saved: f64,
    pub images_compressed: usize,
    pub output_path: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ExtractTextResult {
    pub pages_processed: usize,
    pub characters_extracted: usize,
    pub output_path: String,
    pub is_scanned: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ExtractImagesResult {
    pub pages_processed: usize,
    pub images_found: usize,
    pub output_folder: String,
    pub extracted_files: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PageNumberOptionsDto {
    pub position: String,
    pub font_size: f32,
    pub start_number: u32,
    pub format: String,
    pub margin: Option<f32>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PageNumberResult {
    pub pages_processed: usize,
    pub output_path: String,
}

#[tauri::command]
pub fn pick_pdf_files() -> Result<LoadFilesResult, String> {
    let files = rfd::FileDialog::new()
        .add_filter("PDF files", &["pdf"])
        .pick_files();

    let paths = match files {
        Some(p) => p,
        None => return Ok(LoadFilesResult { files: Vec::new(), errors: Vec::new() }),
    };

    let mut result_files = Vec::new();
    let mut errors = Vec::new();

    for path in paths {
        let path_str = path.to_string_lossy().to_string();
        let name = path
            .file_name()
            .map(|n| n.to_string_lossy().to_string())
            .unwrap_or_else(|| "Unknown.pdf".to_string());

        match pdf_engine::get_pdf_metadata(&path) {
            Ok((page_count, size)) => {
                result_files.push(PdfFileInfo {
                    path: path_str,
                    name,
                    size,
                    page_count,
                });
            }
            Err(err) => {
                errors.push(err);
            }
        }
    }

    Ok(LoadFilesResult {
        files: result_files,
        errors,
    })
}

#[tauri::command]
pub fn inspect_pdf_files(paths: Vec<String>) -> Result<LoadFilesResult, String> {
    let mut result_files = Vec::new();
    let mut errors = Vec::new();

    for path_str in paths {
        let path = PathBuf::from(&path_str);
        if !path.exists() || !path.is_file() {
            errors.push(format!("File not found: {}", path_str));
            continue;
        }

        let name = path
            .file_name()
            .map(|n| n.to_string_lossy().to_string())
            .unwrap_or_else(|| "Unknown.pdf".to_string());

        match pdf_engine::get_pdf_metadata(&path) {
            Ok((page_count, size)) => {
                result_files.push(PdfFileInfo {
                    path: path_str,
                    name,
                    size,
                    page_count,
                });
            }
            Err(err) => {
                errors.push(err);
            }
        }
    }

    Ok(LoadFilesResult {
        files: result_files,
        errors,
    })
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
        return Err("Please add at least 2 PDF files to perform a merge".to_string());
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

#[tauri::command]
pub fn compress_pdf(
    input_path: String,
    quality: String,
    output_path: String,
) -> Result<CompressResult, String> {
    let in_path = PathBuf::from(&input_path);
    if !in_path.exists() {
        return Err(format!("File does not exist: {}", input_path));
    }

    let level: pdf_engine::CompressionLevel = quality.parse()?;
    let out_path = PathBuf::from(&output_path);

    let stats = pdf_engine::compress_document(&in_path, level, &out_path)?;

    Ok(CompressResult {
        original_size: stats.original_size,
        compressed_size: stats.compressed_size,
        bytes_saved: stats.bytes_saved,
        percentage_saved: stats.percentage_saved,
        images_compressed: stats.images_compressed,
        output_path,
    })
}

#[tauri::command]
pub fn extract_pdf_text(
    input_path: String,
    output_path: String,
) -> Result<ExtractTextResult, String> {
    let in_path = PathBuf::from(&input_path);
    if !in_path.exists() {
        return Err(format!("File does not exist: {}", input_path));
    }
    let out_path = PathBuf::from(&output_path);

    let stats = pdf_engine::extract_text_content(&in_path, &out_path)?;

    Ok(ExtractTextResult {
        pages_processed: stats.pages_processed,
        characters_extracted: stats.characters_extracted,
        output_path,
        is_scanned: stats.is_scanned,
    })
}

#[tauri::command]
pub fn extract_pdf_images(
    input_path: String,
    output_folder: String,
) -> Result<ExtractImagesResult, String> {
    let in_path = PathBuf::from(&input_path);
    if !in_path.exists() {
        return Err(format!("File does not exist: {}", input_path));
    }
    let out_dir = PathBuf::from(&output_folder);

    let stats = pdf_engine::extract_images_content(&in_path, &out_dir)?;

    Ok(ExtractImagesResult {
        pages_processed: stats.pages_processed,
        images_found: stats.images_found,
        output_folder,
        extracted_files: stats.extracted_files,
    })
}

#[tauri::command]
pub fn save_txt_dialog(default_name: String) -> Result<Option<String>, String> {
    let file = rfd::FileDialog::new()
        .add_filter("Text files", &["txt"])
        .set_file_name(&default_name)
        .save_file();

    Ok(file.map(|p| p.to_string_lossy().to_string()))
}

#[tauri::command]
pub fn pick_folder_dialog() -> Result<Option<String>, String> {
    let folder = rfd::FileDialog::new().pick_folder();

    Ok(folder.map(|p| p.to_string_lossy().to_string()))
}

#[tauri::command]
pub fn add_page_numbers(
    input_path: String,
    output_path: String,
    options: PageNumberOptionsDto,
) -> Result<PageNumberResult, String> {
    let in_path = PathBuf::from(&input_path);
    if !in_path.exists() {
        return Err(format!("File does not exist: {}", input_path));
    }
    let out_path = PathBuf::from(&output_path);

    let position: pdf_engine::PageNumberPosition = options.position.parse()?;
    let engine_options = pdf_engine::PageNumberOptions {
        position,
        font_size: options.font_size,
        start_number: options.start_number,
        format: options.format,
        margin: options.margin.unwrap_or(36.0),
    };

    let stats = pdf_engine::add_page_numbers_to_pdf(&in_path, &out_path, &engine_options)?;

    Ok(PageNumberResult {
        pages_processed: stats.pages_processed,
        output_path: stats.output_path,
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    use lopdf::content::{Content, Operation};
    use lopdf::{dictionary, Document, Object, Stream};
    use std::path::Path;

    fn create_test_image_pdf(path: &Path) {
        let mut doc = Document::with_version("1.5");
        let pages_id = doc.new_object_id();

        let width = 80u32;
        let height = 80u32;
        let mut raw_pixels = Vec::with_capacity((width * height * 3) as usize);
        for y in 0..height {
            for x in 0..width {
                raw_pixels.push((x * 3 % 256) as u8);
                raw_pixels.push((y * 3 % 256) as u8);
                raw_pixels.push(((x + y) * 2 % 256) as u8);
            }
        }

        let image_stream = Stream::new(
            dictionary! {
                "Type" => "XObject",
                "Subtype" => "Image",
                "Width" => width as i64,
                "Height" => height as i64,
                "ColorSpace" => "DeviceRGB",
                "BitsPerComponent" => 8,
            },
            raw_pixels,
        );
        let image_id = doc.add_object(image_stream);

        let resources_id = doc.add_object(dictionary! {
            "XObject" => dictionary! {
                "Im1" => image_id,
            },
        });

        let content = Content {
            operations: vec![
                Operation::new("q", vec![]),
                Operation::new("cm", vec![80.into(), 0.into(), 0.into(), 80.into(), 50.into(), 50.into()]),
                Operation::new("Do", vec!["Im1".into()]),
                Operation::new("Q", vec![]),
            ],
        };
        let content_id = doc.add_object(Stream::new(dictionary! {}, content.encode().unwrap()));

        let page_id = doc.add_object(dictionary! {
            "Type" => "Page",
            "Parent" => pages_id,
            "Contents" => content_id,
            "Resources" => resources_id,
            "MediaBox" => vec![0.into(), 0.into(), 612.into(), 792.into()],
        });

        let pages_dict = dictionary! {
            "Type" => "Pages",
            "Kids" => vec![page_id.into()],
            "Count" => 1,
        };
        doc.objects.insert(pages_id, Object::Dictionary(pages_dict));

        let catalog_id = doc.add_object(dictionary! {
            "Type" => "Catalog",
            "Pages" => pages_id,
        });

        doc.trailer.set("Root", catalog_id);
        doc.save(path).unwrap();
    }

    #[test]
    fn test_compress_pdf_command_levels() {
        let temp_dir = std::env::temp_dir().join("pdf_toolkit_test_cmd_compress");
        std::fs::create_dir_all(&temp_dir).unwrap();

        let in_pdf = temp_dir.join("input.pdf");
        create_test_image_pdf(&in_pdf);

        for quality in ["low", "medium", "high"] {
            let out_pdf = temp_dir.join(format!("output_{}.pdf", quality));
            let result = compress_pdf(
                in_pdf.to_string_lossy().to_string(),
                quality.to_string(),
                out_pdf.to_string_lossy().to_string(),
            );
            assert!(result.is_ok(), "Compression with quality '{}' failed: {:?}", quality, result.err());
            let stats = result.unwrap();
            assert!(stats.compressed_size < stats.original_size);
            assert!(stats.bytes_saved > 0);
            assert!(stats.percentage_saved > 0.0);
            assert_eq!(stats.images_compressed, 1);
            assert!(out_pdf.exists());
        }

        let _ = std::fs::remove_dir_all(temp_dir);
    }

    #[test]
    fn test_compress_pdf_command_nonexistent_file() {
        let result = compress_pdf(
            "C:/nonexistent_file_path_12345.pdf".to_string(),
            "medium".to_string(),
            "C:/output.pdf".to_string(),
        );
        assert!(result.is_err());
        assert!(result.unwrap_err().contains("File does not exist"));
    }

    #[test]
    fn test_compress_pdf_command_overwrite_protection() {
        let temp_dir = std::env::temp_dir().join("pdf_toolkit_test_cmd_overwrite");
        std::fs::create_dir_all(&temp_dir).unwrap();

        let in_pdf = temp_dir.join("same_name.pdf");
        create_test_image_pdf(&in_pdf);

        let result = compress_pdf(
            in_pdf.to_string_lossy().to_string(),
            "low".to_string(),
            in_pdf.to_string_lossy().to_string(),
        );
        assert!(result.is_err());
        assert!(result.unwrap_err().contains("Cannot overwrite the original file"));

        let _ = std::fs::remove_dir_all(temp_dir);
    }

    #[test]
    fn test_extract_pdf_text_command() {
        let temp_dir = std::env::temp_dir().join("pdf_toolkit_test_cmd_extract_text");
        std::fs::create_dir_all(&temp_dir).unwrap();

        let in_pdf = temp_dir.join("input.pdf");
        create_test_image_pdf(&in_pdf);

        let out_txt = temp_dir.join("output.txt");
        let result = extract_pdf_text(
            in_pdf.to_string_lossy().to_string(),
            out_txt.to_string_lossy().to_string(),
        );

        assert!(result.is_ok());
        let stats = result.unwrap();
        assert_eq!(stats.pages_processed, 1);
        assert!(out_txt.exists());

        let _ = std::fs::remove_dir_all(temp_dir);
    }

    #[test]
    fn test_extract_pdf_images_command() {
        let temp_dir = std::env::temp_dir().join("pdf_toolkit_test_cmd_extract_images");
        let out_folder = temp_dir.join("images");
        std::fs::create_dir_all(&out_folder).unwrap();

        let in_pdf = temp_dir.join("input.pdf");
        create_test_image_pdf(&in_pdf);

        let result = extract_pdf_images(
            in_pdf.to_string_lossy().to_string(),
            out_folder.to_string_lossy().to_string(),
        );

        assert!(result.is_ok());
        let stats = result.unwrap();
        assert_eq!(stats.pages_processed, 1);
        assert_eq!(stats.images_found, 1);
        assert_eq!(stats.extracted_files.len(), 1);
        assert!(out_folder.join(&stats.extracted_files[0]).exists());

        let _ = std::fs::remove_dir_all(temp_dir);
    }

    #[test]
    fn test_add_page_numbers_command() {
        let temp_dir = std::env::temp_dir().join("pdf_toolkit_test_cmd_page_numbers");
        std::fs::create_dir_all(&temp_dir).unwrap();

        let in_pdf = temp_dir.join("input.pdf");
        create_test_image_pdf(&in_pdf);

        let out_pdf = temp_dir.join("output_numbered.pdf");
        let options = PageNumberOptionsDto {
            position: "bottom-center".to_string(),
            font_size: 12.0,
            start_number: 1,
            format: "Page X of Y".to_string(),
            margin: Some(36.0),
        };

        let result = add_page_numbers(
            in_pdf.to_string_lossy().to_string(),
            out_pdf.to_string_lossy().to_string(),
            options,
        );

        assert!(result.is_ok());
        let stats = result.unwrap();
        assert_eq!(stats.pages_processed, 1);
        assert!(out_pdf.exists());

        let _ = std::fs::remove_dir_all(temp_dir);
    }
}
