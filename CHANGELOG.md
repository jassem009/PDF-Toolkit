# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.0] — 2026-09-04

### Added
- **PDF Merging Engine**: Combine multiple PDF files into a single unified document using `lopdf`, with automatic object ID renumbering and catalog tree reconstruction.
- **PDF Splitting & Page Extraction**: Split documents by arbitrary page ranges (e.g., `1-5`, `2, 4, 7-9`) with real-time range validation, live page extraction preview, and one-click presets (`First Page`, `Pages 1-5`, `All Pages`).
- **PDF Compression**: Reduce file sizes with three quality levels (Low, Medium, High). Re-encodes embedded images and applies stream compression with detailed byte and percentage savings reports.
- **Text Extraction**: Export selectable text from PDF documents to clean `.txt` files with structured page delimiter markers.
- **Image Extraction**: Extract embedded images (JPEG, PNG) across all pages into a user-selected output directory.
- **Add Page Numbers**: Stamp customizable page numbers with a 6-position interactive visual picker, custom start numbers, margin adjustments, typography sizing, format templates (`Page X of Y`, `X / Y`, `- X -`), and live preview.
- **Organize Pages**: Visual thumbnail grid enabling 90° clockwise/counter-clockwise page rotation, drag-and-drop reordering, and multi-selection deletion with safety confirmation modal.
- **Determinate Progress Bar**: Real-time page-based progress indicator with percentage in the bottom status bar area for long-running operations.
- **Drag-and-Drop & File Picker**: Load multiple PDF documents via native system dialog (`rfd`) or direct desktop drag-and-drop into the application window.
- **Document Sequencing**: Move Up/Down controls to define the exact document merge sequence, view page counts, and inspect formatted file sizes.
- **Check for Updates**: App header action item with current version notification (placeholder for v1.1 updater).

### Changed
- **Consolidated Architecture**: Extracted shared `promptSavePdf`, `promptSaveTxt`, `promptPickFolder`, and `promptPickPdfFiles` into centralized `src/lib/dialogs.ts`.
- **Reusable UI Primitives**: Extracted shared `AlertBanner` component across all 7 feature panels for consistent notifications.
- **Branding & Assets**: Replaced default Tauri placeholder icons with custom high-contrast PDF document motif icon across all platforms and package sizes.
- **Content Security Policy**: Added strict offline CSP (`default-src 'self'`) in `tauri.conf.json`.

### Fixed
- **Dark Mode**: Defined `--bg-secondary` and themed variables for Organize Pages thumbnails, eliminating white glare in dark mode.
- **Overwrite Protection**: Implemented robust canonical-path overwrite guards on Merge and Split in the Rust backend, preventing source PDF corruption.
- **Race Condition Guard**: Blocked concurrent submissions on rapid clicks while native save dialogs are open.
- **Document Switching Race**: Added cancellation request tokens so in-flight thumbnail and page detail loads discard stale responses when switching active documents.

### Security & Safety
- **100% Offline**: All processing occurs locally on the user's machine with zero network egress.
- **Encrypted PDF Detection**: Explicitly detect password-protected and encrypted PDF documents with clear user-facing messages.
- **Non-PDF Ingestion Guard**: Filter and reject non-PDF file drops with informative toast notifications.
- **Range Validation**: Guard against out-of-bounds page requests and reversed ranges.
- **Error Boundary**: Top-level React error boundary prevents blank screen crashes on unexpected exceptions.
