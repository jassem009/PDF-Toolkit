import { useState, useEffect, useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { PdfFileInfo, LoadFilesResult, ActiveTab } from "./types/pdf";
import { FileList } from "./components/FileList";
import { MergePanel } from "./components/MergePanel";
import { SplitPanel } from "./components/SplitPanel";
import "./App.css";

interface ToastNotification {
  type: "success" | "error" | "info";
  message: string;
}

export function App() {
  const [files, setFiles] = useState<PdfFileInfo[]>([]);
  const [selectedFileIndex, setSelectedFileIndex] = useState<number>(0);
  const [activeTab, setActiveTab] = useState<ActiveTab>("merge");
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [toast, setToast] = useState<ToastNotification | null>(null);

  // Auto dismiss toast after 6s
  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => {
      setToast(null);
    }, 6000);
    return () => clearTimeout(timer);
  }, [toast]);

  const showToast = useCallback((type: "success" | "error" | "info", message: string) => {
    setToast({ type, message });
  }, []);

  const dismissToast = useCallback(() => {
    setToast(null);
  }, []);

  // Add files ensuring unique paths
  const addFiles = useCallback((newFiles: PdfFileInfo[]) => {
    if (newFiles.length === 0) return;
    setFiles((prev) => {
      const existingPaths = new Set(prev.map((f) => f.path));
      const filtered = newFiles.filter((f) => !existingPaths.has(f.path));
      if (filtered.length === 0) return prev;
      return [...prev, ...filtered];
    });
  }, []);

  // Handle native file picker dialog
  const handlePickFiles = async () => {
    try {
      const result = await invoke<LoadFilesResult>("pick_pdf_files");
      if (result.files && result.files.length > 0) {
        addFiles(result.files);
        if (result.errors && result.errors.length > 0) {
          showToast("error", result.errors.join("; "));
        } else {
          showToast("success", `Added ${result.files.length} document${result.files.length > 1 ? "s" : ""}`);
        }
      } else if (result.errors && result.errors.length > 0) {
        showToast("error", result.errors.join("; "));
      }
    } catch (err) {
      showToast("error", `Failed to pick files: ${String(err)}`);
    }
  };

  // Inspect paths dropped from desktop
  const handlePathsDropped = useCallback(async (paths: string[]) => {
    try {
      const pdfPaths = paths.filter((p) => p.toLowerCase().endsWith(".pdf"));
      const nonPdfFiles = paths
        .filter((p) => !p.toLowerCase().endsWith(".pdf"))
        .map((p) => p.split(/[\\/]/).pop() || p);

      if (pdfPaths.length === 0) {
        const rejectedNames = nonPdfFiles.length > 0 ? `: ${nonPdfFiles.join(", ")}` : "";
        showToast("error", `Only .pdf files are supported${rejectedNames}`);
        return;
      }

      const result = await invoke<LoadFilesResult>("inspect_pdf_files", {
        paths: pdfPaths,
      });

      if (result.files && result.files.length > 0) {
        addFiles(result.files);
      }

      const combinedErrors: string[] = [];
      if (nonPdfFiles.length > 0) {
        combinedErrors.push(`Ignored non-PDF files: ${nonPdfFiles.join(", ")}`);
      }
      if (result.errors && result.errors.length > 0) {
        combinedErrors.push(...result.errors);
      }

      if (combinedErrors.length > 0) {
        showToast("error", combinedErrors.join("; "));
      } else if (result.files.length > 0) {
        showToast("success", `Loaded ${result.files.length} document${result.files.length > 1 ? "s" : ""}`);
      }
    } catch (err) {
      showToast("error", `Failed to load dropped files: ${String(err)}`);
    }
  }, [addFiles, showToast]);

  // Set up Tauri native drag-drop listener
  useEffect(() => {
    let unlisten: (() => void) | undefined;

    try {
      getCurrentWindow().onDragDropEvent((event) => {
        if (event.payload.type === "over") {
          setIsDragging(true);
        } else if (event.payload.type === "leave") {
          setIsDragging(false);
        } else if (event.payload.type === "drop") {
          setIsDragging(false);
          const droppedPaths = event.payload.paths;
          if (droppedPaths && droppedPaths.length > 0) {
            handlePathsDropped(droppedPaths);
          }
        }
      }).then((fn) => {
        unlisten = fn;
      }).catch((e) => {
        console.warn("Could not register onDragDropEvent:", e);
      });
    } catch (err) {
      console.warn("Tauri window API unavailable:", err);
    }

    return () => {
      if (unlisten) unlisten();
    };
  }, [handlePathsDropped]);

  // Reorder handlers
  const handleMoveUp = (index: number) => {
    if (index <= 0) return;
    setFiles((prev) => {
      const next = [...prev];
      const temp = next[index - 1];
      next[index - 1] = next[index];
      next[index] = temp;
      return next;
    });
    setSelectedFileIndex((curr) => (curr === index ? index - 1 : curr === index - 1 ? index : curr));
  };

  const handleMoveDown = (index: number) => {
    if (index >= files.length - 1) return;
    setFiles((prev) => {
      const next = [...prev];
      const temp = next[index + 1];
      next[index + 1] = next[index];
      next[index] = temp;
      return next;
    });
    setSelectedFileIndex((curr) => (curr === index ? index + 1 : curr === index + 1 ? index : curr));
  };

  const handleRemoveFile = (index: number) => {
    setFiles((prev) => prev.filter((_, i) => i !== index));
    setSelectedFileIndex((curr) => (curr >= index ? Math.max(0, curr - 1) : curr));
  };

  const handleClearAll = () => {
    setFiles([]);
    setSelectedFileIndex(0);
    showToast("info", "All loaded files cleared");
  };

  // Merge Action
  const handleMerge = async () => {
    if (files.length < 2) {
      showToast("error", "Please add at least 2 PDF files to perform a merge");
      return;
    }

    try {
      const savePath = await invoke<string | null>("save_pdf_dialog", {
        defaultName: "merged.pdf",
      });

      if (!savePath) return; // User canceled dialog

      setIsProcessing(true);
      const inputPaths = files.map((f) => f.path);
      const result = await invoke<string>("merge_pdfs", {
        inputPaths,
        outputPath: savePath,
      });

      showToast("success", result);
    } catch (err) {
      showToast("error", `Merge failed: ${String(err)}`);
    } finally {
      setIsProcessing(false);
    }
  };

  // Split Action
  const handleSplit = async (pageRange: string) => {
    const targetFile = files[selectedFileIndex];
    if (!targetFile) {
      showToast("error", "Please select a PDF document to split");
      return;
    }

    try {
      const baseName = targetFile.name.replace(/\.pdf$/i, "");
      const defaultName = `${baseName}_split.pdf`;

      const savePath = await invoke<string | null>("save_pdf_dialog", {
        defaultName,
      });

      if (!savePath) return; // User canceled dialog

      setIsProcessing(true);
      const result = await invoke<string>("split_pdf", {
        inputPath: targetFile.path,
        pageRange,
        outputPath: savePath,
      });

      showToast("success", result);
    } catch (err) {
      showToast("error", `Split failed: ${String(err)}`);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="app-container">
      {/* Toast Notification Popup */}
      {toast && (
        <div className={`toast-popup ${toast.type}`}>
          <div className="toast-icon">
            {toast.type === "success" ? "✓" : toast.type === "error" ? "⚠️" : "ℹ️"}
          </div>
          <div className="toast-message">{toast.message}</div>
          <button className="toast-close" onClick={dismissToast} title="Dismiss">
            ✕
          </button>
        </div>
      )}

      {/* Top Application Bar */}
      <header className="app-header">
        <div className="header-brand">
          <div className="brand-logo">PDF</div>
          <div className="brand-text">
            <span className="app-name">PDF Toolkit</span>
            <span className="app-tagline">MVP • Fast & Private PDF Utility</span>
          </div>
        </div>

        {/* Tab Navigation */}
        <nav className="tab-nav">
          <button
            className={`tab-button ${activeTab === "merge" ? "active" : ""}`}
            onClick={() => setActiveTab("merge")}
          >
            Merge PDFs
          </button>
          <button
            className={`tab-button ${activeTab === "split" ? "active" : ""}`}
            onClick={() => setActiveTab("split")}
          >
            Split PDF
          </button>
        </nav>
      </header>

      {/* Two-Panel Workspace */}
      <div className="app-body">
        {/* Left Panel: Loaded Files */}
        <FileList
          files={files}
          selectedFileIndex={selectedFileIndex}
          onSelectFile={(idx) => setSelectedFileIndex(idx)}
          onAddFiles={handlePickFiles}
          onRemoveFile={handleRemoveFile}
          onMoveUp={handleMoveUp}
          onMoveDown={handleMoveDown}
          onClearAll={handleClearAll}
          isDragging={isDragging}
          setIsDragging={setIsDragging}
          onFilesDropped={handlePathsDropped}
        />

        {/* Right Panel: Active Action Card */}
        <main className="right-panel">
          {activeTab === "merge" ? (
            <MergePanel
              files={files}
              isProcessing={isProcessing}
              onMerge={handleMerge}
              statusMessage={toast?.type === "success" ? toast.message : null}
              errorMessage={toast?.type === "error" ? toast.message : null}
            />
          ) : (
            <SplitPanel
              files={files}
              selectedIndex={selectedFileIndex}
              onSelectFile={(idx) => setSelectedFileIndex(idx)}
              isProcessing={isProcessing}
              onSplit={handleSplit}
              statusMessage={toast?.type === "success" ? toast.message : null}
              errorMessage={toast?.type === "error" ? toast.message : null}
            />
          )}
        </main>
      </div>
    </div>
  );
}

export default App;
