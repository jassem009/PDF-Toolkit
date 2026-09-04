# PDF Toolkit

> **Merge, split, compress, extract, and organize PDFs. Offline. Private. Yours forever.**

PDF Toolkit is a high-performance commercial desktop utility designed for speed, privacy, and seamless PDF manipulation. All file processing happens locally on your machine by default, providing enterprise-grade security and zero cloud upload latency.

---

## Why PDF Toolkit?

- **One-time purchase (no subscription)**: Pay once, own it forever. No monthly subscriptions, no recurring paywalls, and no artificially locked features.
- **100% offline (your files never leave your machine)**: Zero data collection, telemetry-free, and no cloud uploads. Confidential legal documents, financial reports, and personal records remain strictly on your device.
- **Lightweight & fast**: Built with a native Rust core (`lopdf`, multithreaded processing) and a responsive desktop UI. Launches instantly with negligible memory usage.

---

## Features

- **Merge PDFs**: Combine multiple PDF documents into a single unified file. Reorder documents with intuitive Move Up/Down controls to set the exact merge sequence.
- **Split PDF**: Extract single pages or arbitrary page ranges (e.g., `1-5`, `2, 4, 7-9`) with real-time range validation, live page extraction preview, and one-click presets (`First Page`, `Pages 1-5`, `All Pages`).
- **Compress PDF**: Reduce bloated document sizes with three specialized compression levels (Low, Medium, High). Re-encodes embedded images and applies stream compression with a detailed byte savings report.
- **Extract Text**: Extract selectable text from entire PDF documents into clean, structured `.txt` files with clear page delimiter markers.
- **Extract Images**: Automatically extract embedded images (JPEG, PNG) across all pages and save them into a designated folder.
- **Add Page Numbers**: Stamp customizable page numbers with a 6-position interactive visual picker, custom start numbers, typography sizing, custom format presets (`Page X of Y`, `X / Y`, `- X -`), and live first-page preview.
- **Organize Pages**: Visual thumbnail grid enabling 90° clockwise/counter-clockwise page rotation, drag-and-drop reordering, and multi-selection deletion with safety confirmation.
- **Determinate Progress Bar**: Real-time page-based progress indicator and bottom status bar for long-running operations on large documents.
- **Safety Overwrite Guards**: Canonical path checking ensures output destinations never overwrite source PDF files.

---

## Screenshots

<!-- App Screenshot Placeholder -->
```
┌──────────────────────────────────────────────────────────────────────────────┐
│  PDF  PDF Toolkit                  [Merge] [Split] [Compress] [...] [Organize]│
├──────────────────────────┬───────────────────────────────────────────────────┤
│ Loaded Documents (3)     │ Organize Pages: Quarterly_Report.pdf              │
│                          │                                                   │
│ 📄 Annual_Report.pdf     │  ┌───────┐   ┌───────┐   ┌───────┐   ┌───────┐    │
│    24 pages • 4.2 MB     │  │   1   │   │   2   │   │   3   │   │   4   │    │
│                          │  │ [ ⟳ ] │   │ [ ⟳ ] │   │ [ ⟳ ] │   │ [ ⟳ ] │    │
│ 📄 Quarterly_Report.pdf  │  └───────┘   └───────┘   └───────┘   └───────┘    │
│    12 pages • 1.8 MB     │                                                   │
│                          │  [ ⟲ Rotate All ]  [ 🗑 Delete Selected ]          │
│ 📄 Appendix.pdf          │  [ 💾 Export Modified PDF... ]                    │
│    6 pages • 820 KB      │                                                   │
├──────────────────────────┴───────────────────────────────────────────────────┤
│ ● 3 documents loaded (42 total pages) • Ready               Local Engine     │
└──────────────────────────────────────────────────────────────────────────────┘
```

---

## Downloads

| Platform | Package Format | Download Link |
|:---|:---|:---|
| **Windows (x64)** | `.msi` Installer / `.exe` Setup | [Download for Windows (v1.0.0)](#) *(Placeholder)* |
| **macOS (Apple Silicon & Intel)** | `.dmg` Disk Image / `.app` | [Download for macOS (v1.0.0)](#) *(Placeholder)* |
| **Linux** | `.deb` / `.AppImage` | [Download for Linux (v1.0.0)](#) *(Placeholder)* |

---

## System Requirements

- **Windows**: Windows 10 (64-bit) or Windows 11
- **macOS**: macOS 12 (Monterey) or later (Apple Silicon M1/M2/M3/M4 & Intel x86_64)
- **Linux**: Ubuntu 20.04+, Debian 11+, Fedora 36+, or equivalent modern Linux distribution with WebKit2GTK
- **Memory**: 512 MB RAM minimum (2 GB recommended for 200+ page PDF operations)
- **Storage**: ~50 MB available disk space

---

## Building from Source

For development setup, architecture guidelines, and engineering workflows, consult [AGENTS.md](AGENTS.md).

### Prerequisites
- [Node.js](https://nodejs.org/) (v18+) & `npm`
- [Rust & Cargo](https://www.rust-lang.org/tools/install) (stable toolchain)

### Setup & Run
```powershell
# Install frontend dependencies
npm install

# Run the full desktop app in development mode
npm run tauri dev

# Run frontend preview in browser
npm run dev

# Run full test suite
cargo test --manifest-path src-tauri/Cargo.toml
npm run build

# Package production release binaries
npm run tauri build
```

---

## License

Copyright © 2026 PDF Toolkit Team. All rights reserved.
