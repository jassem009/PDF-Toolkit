use lopdf::content::Content;
use lopdf::{Document, Object, ObjectId};
use std::collections::{BTreeMap, HashSet};
use std::path::{Path, PathBuf};

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum CompressionLevel {
    Low,
    Medium,
    High,
}

impl std::str::FromStr for CompressionLevel {
    type Err = String;

    fn from_str(s: &str) -> Result<Self, Self::Err> {
        match s.to_lowercase().as_str() {
            "low" => Ok(Self::Low),
            "medium" => Ok(Self::Medium),
            "high" => Ok(Self::High),
            _ => Err(format!(
                "Unknown compression level: '{}'. Expected 'low', 'medium', or 'high'.",
                s
            )),
        }
    }
}

impl CompressionLevel {

    pub fn jpeg_quality(&self) -> u8 {
        match self {
            Self::Low => 35,
            Self::Medium => 65,
            Self::High => 85,
        }
    }

    pub fn max_dimension(&self) -> Option<u32> {
        match self {
            Self::Low => Some(1200),
            Self::Medium => Some(2000),
            Self::High => None,
        }
    }
}

#[derive(Debug, Clone)]
pub struct CompressionStats {
    pub original_size: u64,
    pub compressed_size: u64,
    pub bytes_saved: u64,
    pub percentage_saved: f64,
    pub images_compressed: usize,
}

#[derive(Debug, Clone)]
pub struct TextExtractionStats {
    pub pages_processed: usize,
    pub characters_extracted: usize,
    pub output_path: String,
    pub is_scanned: bool,
}

#[derive(Debug, Clone)]
pub struct ImageExtractionStats {
    pub pages_processed: usize,
    pub images_found: usize,
    pub output_folder: String,
    pub extracted_files: Vec<String>,
}

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

/// Attempt to decode, re-encode, and compress an image stream using JPEG compression.
fn try_compress_image_stream(stream: &mut lopdf::Stream, level: CompressionLevel) -> bool {
    let is_image = stream
        .dict
        .get(b"Subtype")
        .and_then(|obj| obj.as_name())
        .map(|name| name == b"Image")
        .unwrap_or(false);

    if !is_image {
        return false;
    }

    let original_len = stream.content.len();
    if original_len == 0 {
        return false;
    }

    // Try multiple decoding strategies:
    let decoded_img = (|| -> Option<image::DynamicImage> {
        // Strategy 1: Load directly as JPEG if DCTDecode
        let is_dct = stream
            .dict
            .get(b"Filter")
            .and_then(|f| f.as_name())
            .map(|n| n == b"DCTDecode")
            .unwrap_or(false);

        if is_dct {
            if let Ok(img) = image::load_from_memory_with_format(&stream.content, image::ImageFormat::Jpeg) {
                return Some(img);
            }
        }

        // Strategy 2: Load directly from stream content (PNG or JPEG)
        if let Ok(img) = image::load_from_memory(&stream.content) {
            return Some(img);
        }

        // Strategy 3: Try decompressed content
        if let Ok(decompressed) = stream.decompressed_content() {
            if let Ok(img) = image::load_from_memory(&decompressed) {
                return Some(img);
            }

            // Strategy 4: Raw pixel buffer reconstruction
            let width = stream.dict.get(b"Width").and_then(|w| w.as_i64()).unwrap_or(0) as u32;
            let height = stream.dict.get(b"Height").and_then(|h| h.as_i64()).unwrap_or(0) as u32;
            let color_space = stream
                .dict
                .get(b"ColorSpace")
                .and_then(|c| c.as_name())
                .unwrap_or(b"DeviceRGB");
            let bpc = stream
                .dict
                .get(b"BitsPerComponent")
                .and_then(|b| b.as_i64())
                .unwrap_or(8) as u32;

            if bpc == 8 && width > 0 && height > 0 {
                let pixel_count = (width * height) as usize;
                if (color_space == b"DeviceRGB" || color_space == b"RGB")
                    && decompressed.len() == pixel_count * 3
                {
                    return image::RgbImage::from_raw(width, height, decompressed)
                        .map(image::DynamicImage::ImageRgb8);
                } else if (color_space == b"DeviceGray" || color_space == b"G")
                    && decompressed.len() == pixel_count
                {
                    return image::GrayImage::from_raw(width, height, decompressed)
                        .map(image::DynamicImage::ImageLuma8);
                }
            }
        }

        None
    })();

    let mut dynamic_img = match decoded_img {
        Some(img) => img,
        None => return false,
    };

    // Downscale if maximum dimension is specified
    if let Some(max_dim) = level.max_dimension() {
        if dynamic_img.width() > max_dim || dynamic_img.height() > max_dim {
            dynamic_img = dynamic_img.resize(max_dim, max_dim, image::imageops::FilterType::Triangle);
        }
    }

    // Re-encode to JPEG
    let rgb = dynamic_img.to_rgb8();
    let mut encoded_jpeg = Vec::new();
    let mut encoder =
        image::codecs::jpeg::JpegEncoder::new_with_quality(&mut encoded_jpeg, level.jpeg_quality());

    if encoder
        .encode(
            rgb.as_raw(),
            rgb.width(),
            rgb.height(),
            image::ExtendedColorType::Rgb8,
        )
        .is_ok()
    {
        // Only replace if re-encoding genuinely reduced the byte size
        if encoded_jpeg.len() < original_len {
            stream.set_content(encoded_jpeg);
            stream.dict.set("Filter", "DCTDecode");
            stream.dict.set("ColorSpace", "DeviceRGB");
            stream.dict.set("BitsPerComponent", 8);
            stream.dict.set("Width", rgb.width() as i64);
            stream.dict.set("Height", rgb.height() as i64);
            stream.dict.remove(b"DecodeParms");
            return true;
        }
    }

    false
}

/// Compress a PDF document by re-encoding embedded images and applying Flate stream compression.
pub fn compress_document(
    input_path: &Path,
    level: CompressionLevel,
    output_path: &Path,
) -> Result<CompressionStats, String> {
    // Check non-overwrite safeguard
    if let (Ok(in_canon), Ok(out_canon)) = (input_path.canonicalize(), output_path.canonicalize()) {
        if in_canon == out_canon {
            return Err(
                "Cannot overwrite the original file. Please choose a different destination."
                    .to_string(),
            );
        }
    } else if input_path == output_path {
        return Err(
            "Cannot overwrite the original file. Please choose a different destination.".to_string(),
        );
    }

    let original_metadata = std::fs::metadata(input_path)
        .map_err(|e| format!("Failed to read input file metadata: {}", e))?;
    let original_size = original_metadata.len();

    let mut doc = load_pdf_safely(input_path)?;
    let mut images_compressed = 0;

    for object in doc.objects.values_mut() {
        if let Object::Stream(ref mut stream) = object {
            if try_compress_image_stream(stream, level) {
                images_compressed += 1;
            } else {
                // For non-image streams or unmodified streams, compress uncompressed text/fonts
                let _ = stream.compress();
            }
        }
    }

    // Save to temporary memory buffer to check exact final size
    let mut temp_buffer = Vec::new();
    doc.save_to(&mut temp_buffer)
        .map_err(|e| format!("Failed to generate compressed PDF: {}", e))?;

    let compressed_size = temp_buffer.len() as u64;

    // If no images could be compressed and size did not reduce:
    if images_compressed == 0 && compressed_size >= original_size {
        return Err("This PDF is already well-compressed".to_string());
    }

    // If final compressed size is not smaller than original:
    if compressed_size >= original_size {
        return Err("This PDF is already well-compressed".to_string());
    }

    // Write final output file
    std::fs::write(output_path, &temp_buffer)
        .map_err(|e| format!("Failed to write compressed output file: {}", e))?;

    let bytes_saved = original_size - compressed_size;
    let percentage_saved = (bytes_saved as f64 / original_size as f64) * 100.0;

    Ok(CompressionStats {
        original_size,
        compressed_size,
        bytes_saved,
        percentage_saved,
        images_compressed,
    })
}

/// Helper to check if a stream object is an Image XObject
pub fn is_image_stream(stream: &lopdf::Stream) -> bool {
    stream
        .dict
        .get(b"Subtype")
        .and_then(|obj| obj.as_name())
        .map(|name| name == b"Image")
        .unwrap_or(false)
}

/// Helper to check whether a stream's /Filter includes a given filter name or short abbreviation.
pub fn stream_has_filter(stream: &lopdf::Stream, target: &[u8], short_target: &[u8]) -> bool {
    if let Ok(filter_obj) = stream.dict.get(b"Filter") {
        match filter_obj {
            Object::Name(ref name) => name == target || name == short_target,
            Object::Array(ref arr) => arr.iter().any(|item| {
                if let Ok(name) = item.as_name() {
                    name == target || name == short_target
                } else {
                    false
                }
            }),
            _ => false,
        }
    } else {
        false
    }
}

/// Helper to decode any supported image stream into a DynamicImage
pub fn decode_image_stream(stream: &lopdf::Stream) -> Option<image::DynamicImage> {
    // Strategy 1: Load directly as JPEG if DCTDecode
    let is_dct = stream_has_filter(stream, b"DCTDecode", b"DCT");

    if is_dct {
        if let Ok(img) =
            image::load_from_memory_with_format(&stream.content, image::ImageFormat::Jpeg)
        {
            return Some(img);
        }
    }

    // Strategy 2: Load directly from stream content (PNG, JPEG, etc.)
    if let Ok(img) = image::load_from_memory(&stream.content) {
        return Some(img);
    }

    // Strategy 3: Try decompressed content
    if let Ok(decompressed) = stream.decompressed_content() {
        if let Ok(img) = image::load_from_memory(&decompressed) {
            return Some(img);
        }

        // Strategy 4: Raw pixel buffer reconstruction
        let width = stream.dict.get(b"Width").and_then(|w| w.as_i64()).unwrap_or(0) as u32;
        let height = stream.dict.get(b"Height").and_then(|h| h.as_i64()).unwrap_or(0) as u32;
        let color_space = stream
            .dict
            .get(b"ColorSpace")
            .and_then(|c| c.as_name())
            .unwrap_or(b"DeviceRGB");
        let bpc = stream
            .dict
            .get(b"BitsPerComponent")
            .and_then(|b| b.as_i64())
            .unwrap_or(8) as u32;

        if bpc == 8 && width > 0 && height > 0 {
            let pixel_count = (width * height) as usize;
            if (color_space == b"DeviceRGB" || color_space == b"RGB")
                && decompressed.len() >= pixel_count * 3
            {
                return image::RgbImage::from_raw(
                    width,
                    height,
                    decompressed[..pixel_count * 3].to_vec(),
                )
                .map(image::DynamicImage::ImageRgb8);
            } else if (color_space == b"DeviceGray" || color_space == b"G")
                && decompressed.len() >= pixel_count
            {
                return image::GrayImage::from_raw(
                    width,
                    height,
                    decompressed[..pixel_count].to_vec(),
                )
                .map(image::DynamicImage::ImageLuma8);
            }
        }
    }

    None
}

/// Decode raw PDF string bytes considering UTF-16BE BOM, ToUnicode CMap, multi-byte UTF-8, and font encodings.
fn decode_pdf_string(bytes: &[u8], encoding: Option<&lopdf::Encoding>) -> String {
    // 1. Check for UTF-16BE BOM: 0xFE, 0xFF
    if bytes.len() >= 2 && bytes[0] == 0xFE && bytes[1] == 0xFF {
        let u16_chars: Vec<u16> = bytes[2..]
            .chunks_exact(2)
            .map(|chunk| u16::from_be_bytes([chunk[0], chunk[1]]))
            .collect();
        if let Ok(s) = String::from_utf16(&u16_chars) {
            return s;
        }
    }

    // 2. If font has a ToUnicode map (UnicodeMapEncoding), that takes highest precedence
    if let Some(enc @ lopdf::Encoding::UnicodeMapEncoding(_)) = encoding {
        let mut out = String::new();
        if enc.write_to_string(bytes, &mut out).is_ok() && !out.is_empty() {
            return out;
        }
    }

    // 3. Check if the raw bytes are valid UTF-8 with multi-byte characters
    if let Ok(s) = std::str::from_utf8(bytes) {
        if s.chars().any(|c| c as u32 > 127) {
            return s.to_string();
        }
    }

    // 4. Use font's encoding if available
    if let Some(enc) = encoding {
        let mut out = String::new();
        if enc.write_to_string(bytes, &mut out).is_ok() && !out.is_empty() {
            return out;
        }
    }

    // 5. Fallback to WinAnsi decoding for 8-bit Latin characters
    let mut out = String::new();
    let win_ansi = lopdf::Encoding::SimpleEncoding(b"WinAnsiEncoding");
    if win_ansi.write_to_string(bytes, &mut out).is_ok() {
        return out;
    }

    // 6. Final fallback: lossy utf-8
    String::from_utf8_lossy(bytes).into_owned()
}

/// Robust page text extractor that preserves line breaks and word spacing across PDF positioning operators.
fn extract_page_text_clean(doc: &Document, page_num: u32) -> String {
    let pages = doc.get_pages();
    let page_id = match pages.get(&page_num) {
        Some(id) => *id,
        None => return String::new(),
    };

    let fonts = doc.get_page_fonts(page_id).unwrap_or_default();
    let encodings: BTreeMap<Vec<u8>, lopdf::Encoding> = fonts
        .into_iter()
        .filter_map(|(name, font)| {
            font.get_font_encoding(doc).ok().map(|enc| (name, enc))
        })
        .collect();

    let content_data = doc.get_page_content(page_id);
    if content_data.is_empty() {
        return String::new();
    }

    let content = match Content::decode(&content_data) {
        Ok(c) => c,
        Err(_) => {
            return doc.extract_text(&[page_num]).unwrap_or_default().trim().to_string();
        }
    };

    let mut current_font_name: Option<Vec<u8>> = None;
    let mut full_page = String::new();
    let mut current_line = String::new();
    let mut last_y: Option<f32> = None;

    for op in &content.operations {
        match op.operator.as_str() {
            "Tf" => {
                if let Some(first) = op.operands.first() {
                    if let Ok(name) = first.as_name() {
                        current_font_name = Some(name.to_vec());
                    }
                }
            }
            "Td" | "TD" => {
                if op.operands.len() >= 2 {
                    let ty = op.operands[1].as_float().unwrap_or_else(|_| op.operands[1].as_i64().unwrap_or(0) as f32);
                    if ty.abs() > 0.1 {
                        if !current_line.is_empty() {
                            full_page.push_str(current_line.trim_end());
                            full_page.push('\n');
                            current_line.clear();
                        }
                    } else {
                        let tx = op.operands[0].as_float().unwrap_or_else(|_| op.operands[0].as_i64().unwrap_or(0) as f32);
                        if tx.abs() > 2.0 && !current_line.is_empty() && !current_line.ends_with(' ') {
                            current_line.push(' ');
                        }
                    }
                }
            }
            "Tm" => {
                if op.operands.len() >= 6 {
                    let y = op.operands[5].as_float().unwrap_or_else(|_| op.operands[5].as_i64().unwrap_or(0) as f32);
                    if let Some(prev_y) = last_y {
                        if (y - prev_y).abs() > 2.0 && !current_line.is_empty() {
                            full_page.push_str(current_line.trim_end());
                            full_page.push('\n');
                            current_line.clear();
                        }
                    }
                    last_y = Some(y);
                }
            }
            "T*" | "'" => {
                if !current_line.is_empty() {
                    full_page.push_str(current_line.trim_end());
                    full_page.push('\n');
                    current_line.clear();
                }
                if op.operator == "'" {
                    let enc = current_font_name.as_ref().and_then(|n| encodings.get(n));
                    if let Some(Object::String(bytes, _)) = op.operands.first() {
                        let text = decode_pdf_string(bytes, enc);
                        current_line.push_str(&text);
                    }
                }
            }
            "\"" => {
                if !current_line.is_empty() {
                    full_page.push_str(current_line.trim_end());
                    full_page.push('\n');
                    current_line.clear();
                }
                let enc = current_font_name.as_ref().and_then(|n| encodings.get(n));
                if let Some(Object::String(bytes, _)) = op.operands.get(2) {
                    let text = decode_pdf_string(bytes, enc);
                    current_line.push_str(&text);
                }
            }
            "Tj" => {
                let enc = current_font_name.as_ref().and_then(|n| encodings.get(n));
                if let Some(Object::String(bytes, _)) = op.operands.first() {
                    let text = decode_pdf_string(bytes, enc);
                    current_line.push_str(&text);
                }
            }
            "TJ" => {
                let enc = current_font_name.as_ref().and_then(|n| encodings.get(n));
                if let Some(Object::Array(items)) = op.operands.first() {
                    for item in items {
                        match item {
                            Object::String(bytes, _) => {
                                let text = decode_pdf_string(bytes, enc);
                                current_line.push_str(&text);
                            }
                            Object::Integer(i)
                                if *i < -120
                                    && !current_line.is_empty()
                                    && !current_line.ends_with(' ') =>
                            {
                                current_line.push(' ');
                            }
                            Object::Real(r)
                                if *r < -120.0
                                    && !current_line.is_empty()
                                    && !current_line.ends_with(' ') =>
                            {
                                current_line.push(' ');
                            }
                            _ => {}
                        }
                    }
                }
            }
            "ET" if !current_line.is_empty() => {
                full_page.push_str(current_line.trim_end());
                full_page.push('\n');
                current_line.clear();
            }
            _ => {}
        }
    }

    if !current_line.is_empty() {
        full_page.push_str(current_line.trim_end());
        full_page.push('\n');
    }

    let trimmed = full_page.trim().to_string();
    if trimmed.is_empty() {
        doc.extract_text(&[page_num]).unwrap_or_default().trim().to_string()
    } else {
        trimmed
    }
}

/// Helper to resolve dictionary from an Object (directly or via Reference)
fn resolve_dict<'a>(doc: &'a Document, obj: &'a Object) -> Option<&'a lopdf::Dictionary> {
    match obj {
        Object::Dictionary(ref dict) => Some(dict),
        Object::Reference(id) => doc.get_dictionary(*id).ok(),
        _ => None,
    }
}

/// Extract all text content from a PDF document, separating pages with "----- Page N -----".
pub fn extract_text_content(
    input_path: &Path,
    output_txt_path: &Path,
) -> Result<TextExtractionStats, String> {
    if !input_path.exists() {
        return Err(format!("File does not exist: {}", input_path.display()));
    }

    let doc = load_pdf_safely(input_path)?;
    let pages = doc.get_pages();
    let total_pages = pages.len();

    let mut full_text = String::new();
    let mut characters_extracted = 0;

    for page_num in pages.keys() {
        full_text.push_str(&format!("----- Page {} -----\n\n", page_num));
        let page_text = extract_page_text_clean(&doc, *page_num);
        let trimmed = page_text.trim();
        if !trimmed.is_empty() {
            characters_extracted += trimmed.chars().count();
            full_text.push_str(trimmed);
            full_text.push_str("\n\n");
        } else {
            full_text.push('\n');
        }
    }

    let is_scanned = characters_extracted == 0;

    if is_scanned {
        full_text = format!(
            "No selectable text found — this may be a scanned document.\n\n\
             This PDF document does not contain an embedded text layer across its {} page(s).\n\
             Scanned documents require Optical Character Recognition (OCR) to extract text from images.\n",
            total_pages
        );
    }

    std::fs::write(output_txt_path, full_text.as_bytes()).map_err(|e| {
        format!(
            "Failed to write text export to '{}': {}",
            output_txt_path.display(),
            e
        )
    })?;

    Ok(TextExtractionStats {
        pages_processed: total_pages,
        characters_extracted,
        output_path: output_txt_path.to_string_lossy().to_string(),
        is_scanned,
    })
}

/// Extract all embedded images from a PDF into an output directory, preserving original formats where possible.
pub fn extract_images_content(
    input_path: &Path,
    output_dir: &Path,
) -> Result<ImageExtractionStats, String> {
    if !input_path.exists() {
        return Err(format!("File does not exist: {}", input_path.display()));
    }
    if !output_dir.is_dir() {
        return Err(format!(
            "Output directory does not exist: {}",
            output_dir.display()
        ));
    }

    let doc = load_pdf_safely(input_path)?;
    let pages = doc.get_pages();
    let total_pages = pages.len();

    let docname = input_path
        .file_stem()
        .map(|s| s.to_string_lossy().to_string())
        .unwrap_or_else(|| "document".to_string());

    let mut images_found = 0;
    let mut extracted_files = Vec::new();
    let mut processed_stream_ids = HashSet::new();

    // 1. Process images page by page
    for (page_num, page_id) in pages {
        if let Ok(page_dict) = doc.get_dictionary(page_id) {
            if let Ok(res_obj) = page_dict.get(b"Resources") {
                if let Some(res_dict) = resolve_dict(&doc, res_obj) {
                    if let Ok(xobj_obj) = res_dict.get(b"XObject") {
                        if let Some(xobj_dict) = resolve_dict(&doc, xobj_obj) {
                            let mut page_img_idx = 1;
                            for (_, val) in xobj_dict.iter() {
                                if let Object::Reference(stream_id) = val {
                                    if let Ok(Object::Stream(ref stream)) = doc.get_object(*stream_id) {
                                        if is_image_stream(stream) {
                                            let saved_name = save_extracted_image(
                                                &docname,
                                                Some(page_num),
                                                page_img_idx,
                                                stream,
                                                output_dir,
                                            )?;
                                            extracted_files.push(saved_name);
                                            images_found += 1;
                                            page_img_idx += 1;
                                            processed_stream_ids.insert(*stream_id);
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }
    }

    // 2. Process any remaining orphan/document-level images
    let mut orphan_idx = 1;
    for (id, object) in &doc.objects {
        if let Object::Stream(ref stream) = object {
            if is_image_stream(stream) && !processed_stream_ids.contains(id) {
                let saved_name = save_extracted_image(
                    &docname,
                    None,
                    orphan_idx,
                    stream,
                    output_dir,
                )?;
                extracted_files.push(saved_name);
                images_found += 1;
                orphan_idx += 1;
                processed_stream_ids.insert(*id);
            }
        }
    }

    Ok(ImageExtractionStats {
        pages_processed: total_pages,
        images_found,
        output_folder: output_dir.to_string_lossy().to_string(),
        extracted_files,
    })
}

fn save_extracted_image(
    docname: &str,
    page_num: Option<u32>,
    img_idx: usize,
    stream: &lopdf::Stream,
    output_dir: &Path,
) -> Result<String, String> {
    let is_dct = stream_has_filter(stream, b"DCTDecode", b"DCT");
    let is_jpx = stream_has_filter(stream, b"JPXDecode", b"JPX");

    let filename = match page_num {
        Some(p) => {
            if is_dct {
                format!("{}_p{}_img{}.jpg", docname, p, img_idx)
            } else if is_jpx {
                format!("{}_p{}_img{}.jp2", docname, p, img_idx)
            } else {
                format!("{}_p{}_img{}.png", docname, p, img_idx)
            }
        }
        None => {
            if is_dct {
                format!("{}_img{}.jpg", docname, img_idx)
            } else if is_jpx {
                format!("{}_img{}.jp2", docname, img_idx)
            } else {
                format!("{}_img{}.png", docname, img_idx)
            }
        }
    };

    let file_path = output_dir.join(&filename);

    if is_dct || is_jpx {
        // Preserve exact native binary stream
        std::fs::write(&file_path, &stream.content)
            .map_err(|e| format!("Failed to save image '{}': {}", filename, e))?;
    } else {
        // Decode raster and save lossless PNG
        let decoded = decode_image_stream(stream)
            .ok_or_else(|| format!("Could not decode image stream for '{}'", filename))?;
        decoded
            .save_with_format(&file_path, image::ImageFormat::Png)
            .map_err(|e| format!("Failed to save PNG '{}': {}", filename, e))?;
    }

    Ok(filename)
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

    fn create_pdf_with_image(path: &Path) {
        let mut doc = Document::with_version("1.5");
        let pages_id = doc.new_object_id();

        // Generate a 100x100 raw RGB image
        let width = 100u32;
        let height = 100u32;
        let mut raw_pixels = Vec::with_capacity((width * height * 3) as usize);
        for y in 0..height {
            for x in 0..width {
                raw_pixels.push((x % 256) as u8);
                raw_pixels.push((y % 256) as u8);
                raw_pixels.push(((x + y) % 256) as u8);
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
                Operation::new("cm", vec![100.into(), 0.into(), 0.into(), 100.into(), 50.into(), 50.into()]),
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

    #[test]
    fn test_compress_document_with_image() {
        let temp_dir = std::env::temp_dir().join("pdf_toolkit_test_compress");
        std::fs::create_dir_all(&temp_dir).unwrap();

        let image_pdf = temp_dir.join("image_doc.pdf");
        let compressed_pdf = temp_dir.join("compressed_doc.pdf");

        create_pdf_with_image(&image_pdf);
        let orig_size = std::fs::metadata(&image_pdf).unwrap().len();

        let stats = compress_document(&image_pdf, CompressionLevel::Low, &compressed_pdf).unwrap();
        assert!(stats.compressed_size < orig_size);
        assert!(stats.images_compressed >= 1);
        assert!(stats.percentage_saved > 0.0);

        let _ = std::fs::remove_dir_all(temp_dir);
    }

    #[test]
    fn test_already_well_compressed_pdf() {
        let temp_dir = std::env::temp_dir().join("pdf_toolkit_test_well_compressed");
        std::fs::create_dir_all(&temp_dir).unwrap();

        let text_pdf = temp_dir.join("text_doc.pdf");
        let out_pdf = temp_dir.join("out_doc.pdf");

        create_test_pdf(1, &text_pdf);

        let result = compress_document(&text_pdf, CompressionLevel::Medium, &out_pdf);
        assert!(result.is_err());
        assert_eq!(result.unwrap_err(), "This PDF is already well-compressed");

        let _ = std::fs::remove_dir_all(temp_dir);
    }

    #[test]
    fn test_compress_non_overwrite() {
        let temp_dir = std::env::temp_dir().join("pdf_toolkit_test_non_overwrite");
        std::fs::create_dir_all(&temp_dir).unwrap();

        let pdf_path = temp_dir.join("same_path.pdf");
        create_test_pdf(1, &pdf_path);

        let result = compress_document(&pdf_path, CompressionLevel::Medium, &pdf_path);
        assert!(result.is_err());
        assert!(result.unwrap_err().contains("Cannot overwrite the original file"));

        let _ = std::fs::remove_dir_all(temp_dir);
    }

    #[test]
    fn test_extract_text_multi_page() {
        let temp_dir = std::env::temp_dir().join("pdf_toolkit_test_extract_text");
        std::fs::create_dir_all(&temp_dir).unwrap();

        let doc_path = temp_dir.join("multi_page.pdf");
        let txt_path = temp_dir.join("extracted.txt");

        create_test_pdf(2, &doc_path);

        let stats = extract_text_content(&doc_path, &txt_path).unwrap();
        assert_eq!(stats.pages_processed, 2);
        assert!(stats.characters_extracted > 0);
        assert!(!stats.is_scanned);
        assert!(txt_path.exists());

        let contents = std::fs::read_to_string(&txt_path).unwrap();
        assert!(contents.contains("----- Page 1 -----"));
        assert!(contents.contains("----- Page 2 -----"));

        let _ = std::fs::remove_dir_all(temp_dir);
    }

    #[test]
    fn test_extract_text_scanned_pdf() {
        let temp_dir = std::env::temp_dir().join("pdf_toolkit_test_extract_scanned");
        std::fs::create_dir_all(&temp_dir).unwrap();

        let doc_path = temp_dir.join("scanned.pdf");
        let txt_path = temp_dir.join("scanned.txt");

        create_pdf_with_image(&doc_path);

        let stats = extract_text_content(&doc_path, &txt_path).unwrap();
        assert_eq!(stats.characters_extracted, 0);
        assert!(stats.is_scanned);

        let contents = std::fs::read_to_string(&txt_path).unwrap();
        assert!(
            contents.contains("No selectable text found — this may be a scanned document."),
            "Expected scanned document warning in file, got: {}",
            contents
        );

        let _ = std::fs::remove_dir_all(temp_dir);
    }

    #[test]
    fn test_extract_text_unicode_and_layout() {
        let temp_dir = std::env::temp_dir().join("pdf_toolkit_test_extract_unicode");
        std::fs::create_dir_all(&temp_dir).unwrap();

        let doc_path = temp_dir.join("unicode_layout.pdf");
        let txt_path = temp_dir.join("unicode_layout.txt");

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

        let content = Content {
            operations: vec![
                Operation::new("BT", vec![]),
                Operation::new("Tf", vec!["F1".into(), 16.into()]),
                Operation::new("Td", vec![50.into(), 700.into()]),
                Operation::new("Tj", vec![Object::string_literal("Section 1: Overview")]),
                Operation::new("Td", vec![0.into(), (-20).into()]),
                Operation::new("Tj", vec![Object::string_literal("Café crème brûlée & résumé")]),
                Operation::new("Td", vec![0.into(), (-20).into()]),
                Operation::new("Tj", vec![Object::string_literal("Emoji rocket 🚀 success 🎉")]),
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
        doc.trailer.set("Root", catalog_id);
        doc.save(&doc_path).unwrap();

        let stats = extract_text_content(&doc_path, &txt_path).unwrap();
        assert!(!stats.is_scanned);
        assert!(stats.characters_extracted > 0);

        let text = std::fs::read_to_string(&txt_path).unwrap();
        assert!(text.contains("Section 1: Overview\nCafé crème brûlée & résumé"));
        assert!(text.contains("Emoji rocket 🚀 success 🎉"));

        let _ = std::fs::remove_dir_all(temp_dir);
    }

    #[test]
    fn test_extract_images_array_filter() {
        let temp_dir = std::env::temp_dir().join("pdf_toolkit_test_extract_array_filter");
        let out_dir = temp_dir.join("images_out");
        std::fs::create_dir_all(&out_dir).unwrap();

        let doc_path = temp_dir.join("array_filter_doc.pdf");
        let mut doc = Document::with_version("1.5");
        let pages_id = doc.new_object_id();

        let dummy_jpeg = vec![0xFF, 0xD8, 0xFF, 0xE0, 0x00, 0x10, 0x4A, 0x46, 0x49, 0x46, 0xFF, 0xD9];

        let image_stream = Stream::new(
            dictionary! {
                "Type" => "XObject",
                "Subtype" => "Image",
                "Width" => 1,
                "Height" => 1,
                "ColorSpace" => "DeviceRGB",
                "BitsPerComponent" => 8,
                "Filter" => vec![Object::Name(b"DCTDecode".to_vec())],
            },
            dummy_jpeg,
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
            "Kids" => vec![Object::Reference(page_id)],
            "Count" => 1,
        };
        doc.objects.insert(pages_id, Object::Dictionary(pages_dict));

        let catalog_id = doc.add_object(dictionary! {
            "Type" => "Catalog",
            "Pages" => pages_id,
        });
        doc.trailer.set("Root", catalog_id);
        doc.save(&doc_path).unwrap();

        let stats = extract_images_content(&doc_path, &out_dir).unwrap();
        assert_eq!(stats.images_found, 1);
        assert_eq!(stats.extracted_files.len(), 1);
        assert!(stats.extracted_files[0].ends_with(".jpg"));

        let _ = std::fs::remove_dir_all(temp_dir);
    }

    #[test]
    fn test_extract_images_multi_page() {
        let temp_dir = std::env::temp_dir().join("pdf_toolkit_test_extract_images");
        let out_dir = temp_dir.join("images_out");
        std::fs::create_dir_all(&out_dir).unwrap();

        let doc_path = temp_dir.join("img_doc.pdf");
        create_pdf_with_image(&doc_path);

        let stats = extract_images_content(&doc_path, &out_dir).unwrap();
        assert_eq!(stats.pages_processed, 1);
        assert_eq!(stats.images_found, 1);
        assert_eq!(stats.extracted_files.len(), 1);
        assert!(stats.extracted_files[0].starts_with("img_doc_p1_img1"));
        assert!(out_dir.join(&stats.extracted_files[0]).exists());

        let _ = std::fs::remove_dir_all(temp_dir);
    }
}
