use lopdf::{Document, Object, ObjectId};
use std::collections::{BTreeMap, HashSet};
use std::path::{Path, PathBuf};

/// Parse a page range string like "1-5", "2, 4, 6-8", or "3" into a sorted list of unique 1-based page numbers.
pub fn parse_page_range(range_str: &str, total_pages: usize) -> Result<Vec<u32>, String> {
    let trimmed = range_str.trim();
    if trimmed.is_empty() {
        return Err("Page range cannot be empty".to_string());
    }

    let mut pages = HashSet::new();

    for part in trimmed.split(',') {
        let token = part.trim();
        if token.is_empty() {
            continue;
        }

        if let Some((start_str, end_str)) = token.split_once('-') {
            let start: u32 = start_str
                .trim()
                .parse()
                .map_err(|_| format!("Invalid page number in range: '{}'", start_str))?;
            let end: u32 = end_str
                .trim()
                .parse()
                .map_err(|_| format!("Invalid page number in range: '{}'", end_str))?;

            if start == 0 || end == 0 {
                return Err("Page numbers must be 1 or greater".to_string());
            }
            if start > end {
                return Err(format!(
                    "Invalid page range: start ({}) is greater than end ({})",
                    start, end
                ));
            }
            if end as usize > total_pages {
                return Err(format!(
                    "Page {} exceeds total document pages ({})",
                    end, total_pages
                ));
            }

            for p in start..=end {
                pages.insert(p);
            }
        } else {
            let page: u32 = token
                .parse()
                .map_err(|_| format!("Invalid page number: '{}'", token))?;

            if page == 0 {
                return Err("Page numbers must be 1 or greater".to_string());
            }
            if page as usize > total_pages {
                return Err(format!(
                    "Page {} exceeds total document pages ({})",
                    page, total_pages
                ));
            }

            pages.insert(page);
        }
    }

    if pages.is_empty() {
        return Err("No valid pages found in range".to_string());
    }

    let mut sorted_pages: Vec<u32> = pages.into_iter().collect();
    sorted_pages.sort_unstable();
    Ok(sorted_pages)
}

/// Helper to load a PDF and verify it is not encrypted/password-protected.
pub fn load_pdf_safely(path: &Path) -> Result<Document, String> {
    let file_name = path
        .file_name()
        .map(|n| n.to_string_lossy().to_string())
        .unwrap_or_else(|| "PDF".to_string());

    match Document::load(path) {
        Ok(doc) => {
            if doc.is_encrypted() {
                return Err(format!(
                    "'{}': password-protected PDFs are not supported yet",
                    file_name
                ));
            }
            Ok(doc)
        }
        Err(e) => {
            let err_str = e.to_string().to_lowercase();
            if err_str.contains("encrypt") || err_str.contains("password") {
                return Err(format!(
                    "'{}': password-protected PDFs are not supported yet",
                    file_name
                ));
            }
            Err(format!("Failed to load PDF '{}': {}", file_name, e))
        }
    }
}

/// Retrieve PDF page count and file size in bytes.
pub fn get_pdf_metadata(path: &Path) -> Result<(usize, u64), String> {
    let metadata = std::fs::metadata(path)
        .map_err(|e| format!("Failed to read file metadata for {:?}: {}", path, e))?;
    let doc = load_pdf_safely(path)?;
    let page_count = doc.get_pages().len();
    Ok((page_count, metadata.len()))
}

/// Merge multiple PDF documents into a single output PDF file.
pub fn merge_documents(input_paths: &[PathBuf], output_path: &Path) -> Result<(), String> {
    if input_paths.len() < 2 {
        return Err("Please add at least 2 PDF files to perform a merge".to_string());
    }

    let mut loaded_docs = Vec::new();
    for path in input_paths {
        let doc = load_pdf_safely(path)?;
        loaded_docs.push(doc);
    }

    let mut max_id: u32 = 1;
    let mut documents_pages: BTreeMap<ObjectId, Object> = BTreeMap::new();
    let mut documents_objects: BTreeMap<ObjectId, Object> = BTreeMap::new();
    let mut document = Document::with_version("1.5");

    for mut doc in loaded_docs {
        doc.renumber_objects_with(max_id);
        max_id = doc.max_id + 1;

        let pages = doc.get_pages();
        for object_id in pages.values() {
            if let Ok(obj) = doc.get_object(*object_id) {
                documents_pages.insert(*object_id, obj.to_owned());
            }
        }
        documents_objects.extend(doc.objects);
    }

    let mut catalog_object: Option<(ObjectId, Object)> = None;
    let mut pages_object: Option<(ObjectId, Object)> = None;

    for (object_id, object) in documents_objects.into_iter() {
        match object.type_name().unwrap_or(b"") {
            b"Catalog" => {
                catalog_object = Some((
                    catalog_object.map(|(id, _)| id).unwrap_or(object_id),
                    object,
                ));
            }
            b"Pages" => {
                if let Ok(dictionary) = object.as_dict() {
                    let mut dictionary = dictionary.clone();
                    if let Some((_, ref obj)) = pages_object {
                        if let Ok(old_dictionary) = obj.as_dict() {
                            dictionary.extend(old_dictionary);
                        }
                    }
                    pages_object = Some((
                        pages_object.map(|(id, _)| id).unwrap_or(object_id),
                        Object::Dictionary(dictionary),
                    ));
                }
            }
            b"Page" | b"Outlines" | b"Outline" => {}
            _ => {
                document.objects.insert(object_id, object);
            }
        }
    }

    let pages_id = pages_object
        .ok_or_else(|| "Pages root object not found in documents".to_string())?
        .0;
    let catalog_id = catalog_object
        .ok_or_else(|| "Catalog root object not found in documents".to_string())?
        .0;

    for (object_id, object) in documents_pages.iter() {
        if let Ok(dictionary) = object.as_dict() {
            let mut dictionary = dictionary.clone();
            dictionary.set("Parent", pages_id);
            document.objects.insert(*object_id, Object::Dictionary(dictionary));
        }
    }

    let kids: Vec<Object> = documents_pages
        .keys()
        .copied()
        .map(Object::Reference)
        .collect();

    let mut pages_dict = lopdf::Dictionary::new();
    pages_dict.set("Type", "Pages");
    pages_dict.set("Count", kids.len() as u32);
    pages_dict.set("Kids", kids);
    document.objects.insert(pages_id, Object::Dictionary(pages_dict));

    let mut catalog_dict = lopdf::Dictionary::new();
    catalog_dict.set("Type", "Catalog");
    catalog_dict.set("Pages", pages_id);
    document.objects.insert(catalog_id, Object::Dictionary(catalog_dict));

    document.trailer.set("Root", catalog_id);
    document.max_id = document.objects.len() as u32;
    document.renumber_objects();

    document
        .save(output_path)
        .map_err(|e| format!("Failed to save merged PDF: {}", e))?;

    Ok(())
}

/// Extract specific pages from a PDF and save to a new PDF file.
pub fn split_document(
    input_path: &Path,
    pages_to_keep: &[u32],
    output_path: &Path,
) -> Result<(), String> {
    if pages_to_keep.is_empty() {
        return Err("No pages specified to extract".to_string());
    }

    let mut doc = load_pdf_safely(input_path)?;

    let all_pages: Vec<u32> = doc.get_pages().keys().copied().collect();
    let keep_set: HashSet<u32> = pages_to_keep.iter().copied().collect();

    let pages_to_delete: Vec<u32> = all_pages
        .into_iter()
        .filter(|p| !keep_set.contains(p))
        .collect();

    if pages_to_delete.len() == doc.get_pages().len() {
        return Err("Cannot delete all pages from PDF".to_string());
    }

    doc.delete_pages(&pages_to_delete);
    doc.renumber_objects();
    doc.save(output_path)
        .map_err(|e| format!("Failed to save split PDF: {}", e))?;

    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use lopdf::content::{Content, Operation};
    use lopdf::{dictionary, Stream};

    fn create_test_pdf(num_pages: usize, path: &Path) {
        let mut doc = Document::with_version("1.5");
        let pages_id = doc.new_object_id();

        let font_id = doc.add_object(dictionary! {
            "Type" => "Font",
            "Subtype" => "Type1",
            "BaseFont" => "Helvetica",
        });

        let resources_id = doc.add_object(dictionary! {
            "Font" => dictionary! {
                "F1" => font_id,
            },
        });

        let mut kids = Vec::new();

        for i in 1..=num_pages {
            let content = Content {
                operations: vec![
                    Operation::new("BT", vec![]),
                    Operation::new("Tf", vec!["F1".into(), 24.into()]),
                    Operation::new("Td", vec![100.into(), 500.into()]),
                    Operation::new("Tj", vec![Object::string_literal(format!("Page {}", i))]),
                    Operation::new("ET", vec![]),
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
            kids.push(Object::Reference(page_id));
        }

        let pages_dict = dictionary! {
            "Type" => "Pages",
            "Kids" => kids,
            "Count" => num_pages as u32,
        };
        doc.objects.insert(pages_id, Object::Dictionary(pages_dict));

        let catalog_id = doc.add_object(dictionary! {
            "Type" => "Catalog",
            "Pages" => pages_id,
        });

        doc.trailer.set("Root", catalog_id);
        doc.save(path).unwrap();
    }

    fn create_encrypted_pdf(path: &Path) {
        let mut doc = Document::with_version("1.5");
        let pages_id = doc.new_object_id();
        let page_id = doc.add_object(dictionary! {
            "Type" => "Page",
            "Parent" => pages_id,
            "MediaBox" => vec![0.into(), 0.into(), 612.into(), 792.into()],
        });
        let pages_dict = dictionary! {
            "Type" => "Pages",
            "Kids" => vec![Object::Reference(page_id)],
            "Count" => 1,
        };
        doc.objects.insert(pages_id, Object::Dictionary(pages_dict));
        let catalog_id = doc.add_object(dictionary! {
            "Type" => "Catalog",
            "Pages" => pages_id,
        });
        let encrypt_id = doc.add_object(dictionary! {
            "Filter" => "Standard",
            "V" => 2,
            "R" => 3,
            "O" => Object::string_literal("dummy_owner_password_hash"),
            "U" => Object::string_literal("dummy_user_password_hash"),
            "P" => -4,
        });

        doc.trailer.set("Root", catalog_id);
        doc.trailer.set("Encrypt", encrypt_id);
        doc.save(path).unwrap();
    }

    #[test]
    fn test_parse_page_range() {
        assert_eq!(parse_page_range("1-3", 5).unwrap(), vec![1, 2, 3]);
        assert_eq!(parse_page_range(" 2 , 4-5 ", 5).unwrap(), vec![2, 4, 5]);
        assert_eq!(parse_page_range("1, 1, 2", 3).unwrap(), vec![1, 2]);

        assert!(parse_page_range("", 5).is_err());
        assert!(parse_page_range("0", 5).is_err());
        assert!(parse_page_range("1-6", 5).is_err());
        assert!(parse_page_range("5-2", 5).is_err());
        assert!(parse_page_range("abc", 5).is_err());
    }

    #[test]
    fn test_merge_and_split_documents() {
        let temp_dir = std::env::temp_dir().join("pdf_toolkit_test_merge_split");
        std::fs::create_dir_all(&temp_dir).unwrap();

        let doc1 = temp_dir.join("doc1.pdf");
        let doc2 = temp_dir.join("doc2.pdf");
        let merged = temp_dir.join("merged.pdf");
        let split = temp_dir.join("split.pdf");

        create_test_pdf(2, &doc1);
        create_test_pdf(3, &doc2);

        let (p1, _) = get_pdf_metadata(&doc1).unwrap();
        let (p2, _) = get_pdf_metadata(&doc2).unwrap();
        assert_eq!(p1, 2);
        assert_eq!(p2, 3);

        merge_documents(&[doc1.clone(), doc2.clone()], &merged).unwrap();
        let (p_merged, _) = get_pdf_metadata(&merged).unwrap();
        assert_eq!(p_merged, 5);

        split_document(&merged, &[2, 4], &split).unwrap();
        let (p_split, _) = get_pdf_metadata(&split).unwrap();
        assert_eq!(p_split, 2);

        let _ = std::fs::remove_dir_all(temp_dir);
    }

    #[test]
    fn test_encrypted_pdf_rejection() {
        let temp_dir = std::env::temp_dir().join("pdf_toolkit_test_encrypted");
        std::fs::create_dir_all(&temp_dir).unwrap();

        let enc_doc = temp_dir.join("encrypted.pdf");
        create_encrypted_pdf(&enc_doc);

        let result = get_pdf_metadata(&enc_doc);
        assert!(result.is_err());
        let err_msg = result.unwrap_err();
        assert!(
            err_msg.contains("password-protected PDFs are not supported yet"),
            "Expected password-protected message, got: {}",
            err_msg
        );

        let _ = std::fs::remove_dir_all(temp_dir);
    }
}
