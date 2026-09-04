# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- Extract text from PDFs to .txt with page markers
- Extract embedded images from PDFs to a chosen folder
- PDF compression with quality presets and size savings report
- **Drag-and-Drop & File Picker**: Load multiple PDF documents via native system dialog (`rfd`) or direct desktop drag-and-drop into the application window.
- **Document List & Sequencing**: Reorder loaded files with Move Up/Down controls to define the exact merge sequence, view page counts and formatted file sizes, and remove individual or all documents.
- **PDF Merging Engine**: Combine multiple PDF files into a single unified document using `lopdf`, with automatic object ID renumbering and catalog tree reconstruction.
- **Save File Dialog**: Integrated native OS save dialog for choosing destination file paths for merged and split exports.
- **PDF Splitting & Page Extraction**: Split documents by arbitrary page ranges (e.g., `1-5`, `2, 4, 7-9`) with real-time range validation, live page extraction preview, and one-click presets (`First Page`, `Pages 1-5`, `All Pages`).
- **Two-Panel Desktop UI**: Left panel for document ingestion and sequence management; right panel for contextual tool actions (Merge and Split).
- **Toast & Inline Alert System**: Animated notifications for success, rejection, and error states with auto-dismiss and manual close controls.

### Security & Error Handling
- **Encrypted PDF Detection**: Explicitly detect password-protected and encrypted PDF documents, presenting a clear user-facing message (`"password-protected PDFs are not supported yet"`) rather than failing silently or producing corrupted output.
- **Non-PDF Ingestion Guard**: Filter and reject non-PDF file drops with clear toast notifications listing ignored files.
- **Range Validation**: Guard against out-of-bounds page requests (e.g., requesting page 10 on a 5-page PDF) and reversed ranges (e.g., `5-1`).
- **Input Boundaries**: Prevent empty or single-file merge submissions with disabled states and user guidance.
