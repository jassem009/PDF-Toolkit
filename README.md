# PDF Toolkit

A commercial-grade desktop utility application for fast, private, and offline PDF manipulation built with [Tauri 2](https://tauri.app/), [React 19](https://react.dev/), [TypeScript](https://www.typescriptlang.org/), and [Rust](https://www.rust-lang.org/).

## Developer Architecture & Guidelines

For engineering architecture, conventions, workflows, and standards, refer to [AGENTS.md](AGENTS.md).

## Quick Start

### Prerequisites
- [Node.js](https://nodejs.org/) (v18+)
- [Rust & Cargo](https://www.rust-lang.org/tools/install) (stable)

### Installation
```powershell
npm install
```

### Running in Development
```powershell
# Run the full Tauri desktop app
npm run tauri dev

# Or run frontend only in browser
npm run dev
```

### Running Tests
```powershell
# Rust backend checks & tests
cargo check --manifest-path src-tauri/Cargo.toml
cargo test --manifest-path src-tauri/Cargo.toml

# Frontend validation
npm run build
```

### Building Release Binaries
```powershell
npm run tauri build
```
