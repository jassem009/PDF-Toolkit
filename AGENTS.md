# AGENTS.md — PDF Toolkit Engineering Guide

This document defines the architecture, conventions, workflows, and standards for developers and AI agents working on **PDF Toolkit**, a high-performance commercial desktop application.

---

## 1. Project Overview & Philosophy

**PDF Toolkit** is a commercial desktop utility application designed for speed, privacy, and seamless PDF manipulation. All file processing happens locally on the user's machine by default, providing enterprise-grade security and zero cloud upload latency.

---

## 2. Technology Stack

- **Application Framework**: [Tauri 2](https://tauri.app/) (v2.x)
- **Backend**: Rust (Edition 2021)
  - `tauri` (v2) core framework
  - `tauri-plugin-opener` for native system integration
  - `serde` & `serde_json` for cross-boundary data serialization
- **Frontend**: React 19 + TypeScript (~5.8)
  - **Bundler**: [Vite](https://vite.dev/) (v7)
  - **UI / Component Architecture**: shadcn-style component primitives, accessible UI tokens, and Lucide icons
  - **IPC Communication**: `@tauri-apps/api/core` (`invoke`)
- **Package Manager**: `npm`

---

## 3. System Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    React Frontend                       │
│  (UI Components, Tool Workspaces, State, IPC Calls)     │
└────────────────────────────┬────────────────────────────┘
                             │
                  Tauri IPC (invoke / events)
                             │
┌────────────────────────────▼────────────────────────────┐
│                     Rust Backend                        │
│   (Tauri Commands, Native Dialogs, High-Speed PDF I/O)  │
└─────────────────────────────────────────────────────────┘
```

### 3.1 Rust Backend (`src-tauri/`)
- Handles heavy file operations, native file dialogs, secure storage, and multi-threaded PDF processing.
- Exposes callable functions to the frontend using the `#[tauri::command]` attribute.
- Commands must return `Result<T, E>` where `E` implements `serde::Serialize` to ensure informative error messages on the frontend.
- Heavy computations must avoid blocking the main thread (leverage Tokio tasks or threadpools).

### 3.2 React Frontend (`src/`)
- Clean, responsive desktop user experience.
- Communicates with Rust using `@tauri-apps/api/core` `invoke("command_name", { ... })`.
- Implements optimistic UI, drag-and-drop file upload zones, progress indicators, and tool drawers.

---

## 4. Folder Structure & Naming Conventions

### 4.1 Directory Structure
```
PDF-Toolkit/
├── .github/                  # CI/CD workflows and automation
├── public/                   # Static web assets (favicons, logos)
├── src/                      # React TypeScript Frontend
│   ├── assets/               # Local icons, vectors, and graphics
│   ├── components/           # UI Components
│   │   ├── ui/               # Reusable atomic/shadcn-style primitives (Button, Modal, Input)
│   │   └── features/         # Domain-specific tool views (Merge, Split, Rotate, Compress)
│   ├── hooks/                # Custom React hooks (e.g., useTauriCommand, useDropzone)
│   ├── lib/                  # Frontend utilities and Tauri IPC wrappers
│   ├── types/                # Shared TypeScript interfaces & types
│   ├── App.tsx               # Root application component
│   ├── App.css               # App-level styles
│   ├── main.tsx              # React DOM entry point
│   └── index.css             # Design tokens and base styles
├── src-tauri/                # Rust Native Application
│   ├── src/
│   │   ├── commands/         # Modular command handlers (pdf, file, window)
│   │   ├── lib.rs            # Builder configuration, plugin registration, handlers
│   │   └── main.rs           # Windows subsystem release entry point
│   ├── icons/                # Multi-platform application icons (.ico, .icns, .png)
│   ├── Cargo.toml            # Rust dependencies & package metadata
│   ├── tauri.conf.json       # Tauri window, security, and bundle configuration
│   └── capabilities/         # Tauri 2 permission capabilities
├── AGENTS.md                 # Project guide and conventions (this file)
├── package.json              # Frontend scripts and npm dependencies
├── tsconfig.json             # TypeScript compiler configuration
└── vite.config.ts            # Vite bundler configuration
```

### 4.2 Naming Conventions
- **React Components**: `PascalCase.tsx` (e.g., `ToolCard.tsx`, `Button.tsx`).
- **React Hooks**: `camelCase.ts` prefixed with `use` (e.g., `usePdfMetadata.ts`).
- **Utility Files**: `kebab-case.ts` (e.g., `format-bytes.ts`, `tauri-client.ts`).
- **Rust Modules & Files**: `snake_case.rs` (e.g., `pdf_ops.rs`, `file_dialog.rs`).
- **Rust Commands**: `snake_case` (e.g., `#[tauri::command] fn merge_pdf_files(...)`).
- **Rust Structs & Enums**: `PascalCase` (e.g., `PdfPageInfo`, `ProcessStatus`).

---

## 5. Developer Workflows & Commands

### 5.1 Development
- **Run Full Desktop App in Dev Mode**:
  ```powershell
  npm run tauri dev
  ```
  *Spawns the Vite dev server at `http://localhost:1420` and launches the native Tauri window with hot reload enabled for both Rust and TypeScript.*

- **Run Frontend Preview in Browser** (Fast UI work):
  ```powershell
  npm run dev
  ```

### 5.2 Testing & Quality Assurance
- **Frontend Typecheck & Build Validation**:
  ```powershell
  npm run build
  ```
- **Rust Backend Compilation & Lint Check**:
  ```powershell
  cargo check --manifest-path src-tauri/Cargo.toml
  cargo clippy --manifest-path src-tauri/Cargo.toml
  ```
- **Rust Backend Tests**:
  ```powershell
  cargo test --manifest-path src-tauri/Cargo.toml
  ```

### 5.3 Building Production Release Binaries
- **Generate Production Bundles**:
  ```powershell
  npm run tauri build
  ```
- **Build Artifacts**:
  - **Windows**: `.msi` and `.exe` (NSIS) in `src-tauri/target/release/bundle/nsis/`
  - **macOS**: `.dmg` and `.app` in `src-tauri/target/release/bundle/dmg/`
  - **Linux**: `.deb` and `.AppImage` in `src-tauri/target/release/bundle/deb/`

---

## 6. Coding Standards & Agent Guidelines

1. **Safety & Robustness**:
   - Always validate file paths and sizes before invoking native operations.
   - Never panic in Rust commands; always propagate errors using `Result<T, String>` or custom serialized error types.
2. **IPC Efficiency**:
   - Do not pass large binary files across the IPC boundary as raw JSON arrays. Instead, pass file paths or use streaming/chunking mechanisms.
3. **UI Consistency**:
   - Maintain a cohesive design system using clean typography, high contrast, and accessible interactive states.
   - Follow dark/light mode standards with neutral, professional slate palettes.
4. **Git Hygiene**:
   - Keep commits atomic and use conventional commit prefixes (`feat:`, `fix:`, `docs:`, `chore:`, `refactor:`).
