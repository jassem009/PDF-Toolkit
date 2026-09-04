import { useState, useEffect, useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";
import { getCurrentWindow } from "@tauri-apps/api/window";
import {
  PdfFileInfo,
  LoadFilesResult,
  ActiveTab,
  CompressResult,
  CompressionQuality,
  ExtractTextResult,
  ExtractImagesResult,
  PageNumberOptions,
  PageNumberResult,
} from "./types/pdf";
import { FileList } from "./components/FileList";
import { MergePanel } from "./components/MergePanel";
import { SplitPanel } from "./components/SplitPanel";
import { CompressPanel } from "./components/CompressPanel";
import { ExtractTextPanel } from "./components/ExtractTextPanel";
import { ExtractImagesPanel } from "./components/ExtractImagesPanel";
import { PageNumbersPanel } from "./components/PageNumbersPanel";
import { PageNumbersDialog } from "./components/PageNumbersDialog";
import { OrganizePagesPanel } from "./components/OrganizePagesPanel";
import { promptSavePdf, promptSaveTxt, promptPickFolder, promptPickPdfFiles } from "./lib/dialogs";
import "./App.css";

interface ToastNotification {
  type: "success" | "error" | "info";
  message: string;
}

export interface OperationProgress {
  title: string;
  processedPages: number;
  totalPages: number;
  percentage: number;
}

function countPagesFromRange(rangeStr: string, maxPages: number): number {
  if (!rangeStr.trim() || rangeStr.trim().toLowerCase() === "all") return maxPages;
  const parts = rangeStr.split(",");
  const pages = new Set<number>();
  for (const part of parts) {
    const trimmed = part.trim();
    if (trimmed.includes("-")) {
      const [startStr, endStr] = trimmed.split("-");
      const start = parseInt(startStr, 10) || 1;
      const end = parseInt(endStr, 10) || maxPages;
      for (let i = Math.max(1, start); i <= Math.min(maxPages, end); i++) {
        pages.add(i);
      }
    } else {
      const p = parseInt(trimmed, 10);
      if (p >= 1 && p <= maxPages) {
        pages.add(p);
      }
    }
  }
  return pages.size > 0 ? pages.size : maxPages;
}

export function App() {
  const [files, setFiles] = useState<PdfFileInfo[]>([]);
  const [selectedFileIndex, setSelectedFileIndex] = useState<number>(0);
  const [activeTab, setActiveTab] = useState<ActiveTab>("merge");
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [isDialogOpen, setIsDialogOpen] = useState<boolean>(false);
  const isBusy = isProcessing || isDialogOpen;
  const [toast, setToast] = useState<ToastNotification | null>(null);
  const [compressResult, setCompressResult] = useState<CompressResult | null>(null);
  const [compressError, setCompressError] = useState<string | null>(null);
  const [extractTextResult, setExtractTextResult] = useState<ExtractTextResult | null>(null);
  const [extractTextError, setExtractTextError] = useState<string | null>(null);
  const [extractImagesResult, setExtractImagesResult] = useState<ExtractImagesResult | null>(null);
  const [extractImagesError, setExtractImagesError] = useState<string | null>(null);
  const [pageNumberResult, setPageNumberResult] = useState<PageNumberResult | null>(null);
  const [pageNumberError, setPageNumberError] = useState<string | null>(null);
  const [isPageNumbersDialogOpen, setIsPageNumbersDialogOpen] = useState<boolean>(false);
  const [operationProgress, setOperationProgress] = useState<OperationProgress | null>(null);

  const startProgressTracking = useCallback((title: string, totalPages: number) => {
    const safeTotal = Math.max(1, totalPages);
    setOperationProgress({
      title,
      processedPages: 0,
      totalPages: safeTotal,
      percentage: 0,
    });

    const timer = setInterval(() => {
      setOperationProgress((prev) => {
        if (!prev) return null;
        if (prev.processedPages >= prev.totalPages - 1) return prev;
        const step = Math.max(1, Math.ceil(prev.totalPages / 20));
        const nextProcessed = Math.min(prev.totalPages - 1, prev.processedPages + step);
        return {
          ...prev,
          processedPages: nextProcessed,
          percentage: Math.round((nextProcessed / prev.totalPages) * 100),
        };
      });
    }, 80);

    return {
      complete: () => {
        clearInterval(timer);
        setOperationProgress({
          title,
          processedPages: safeTotal,
          totalPages: safeTotal,
          percentage: 100,
        });
        setTimeout(() => setOperationProgress(null), 500);
      },
      cancel: () => {
        clearInterval(timer);
        setOperationProgress(null);
      },
    };
  }, []);

  const clearAllResults = useCallback(() => {
    setCompressResult(null);
    setCompressError(null);
    setExtractTextResult(null);
    setExtractTextError(null);
    setExtractImagesResult(null);
    setExtractImagesError(null);
    setPageNumberResult(null);
    setPageNumberError(null);
  }, []);

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
    if (isBusy) return;
    try {
      setIsDialogOpen(true);
      const result = await promptPickPdfFiles();
      setIsDialogOpen(false);
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
    } finally {
      setIsDialogOpen(false);
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
      }).catch(() => {
        // Native drag-drop registration unsupported in current window context
      });
    } catch {
      // Browser preview mode: native window API not present
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
    if (isBusy) return;
    if (files.length < 2) {
      showToast("error", "Please add at least 2 PDF files to perform a merge");
      return;
    }

    let progressTracker: { complete: () => void; cancel: () => void } | null = null;
    try {
      setIsDialogOpen(true);
      const savePath = await promptSavePdf("merged.pdf");
      setIsDialogOpen(false);

      if (!savePath) return; // User canceled dialog

      setIsProcessing(true);
      const totalPages = files.reduce((acc, f) => acc + (f.page_count || 1), 0);
      progressTracker = startProgressTracking("Merging PDFs", totalPages);

      const inputPaths = files.map((f) => f.path);
      const result = await invoke<string>("merge_pdfs", {
        inputPaths,
        outputPath: savePath,
      });

      progressTracker.complete();
      showToast("success", result);
    } catch (err) {
      if (progressTracker) progressTracker.cancel();
      const errStr = String(err);
      if (errStr.includes("Output would overwrite a source file")) {
        showToast("error", "Output would overwrite a source file — choose a different name");
      } else {
        showToast("error", `Merge failed: ${errStr}`);
      }
    } finally {
      setIsDialogOpen(false);
      setIsProcessing(false);
    }
  };

  // Split Action
  const handleSplit = async (pageRange: string) => {
    if (isBusy) return;
    const targetFile = files[selectedFileIndex];
    if (!targetFile) {
      showToast("error", "Please select a PDF document to split");
      return;
    }

    let progressTracker: { complete: () => void; cancel: () => void } | null = null;
    try {
      const baseName = targetFile.name.replace(/\.pdf$/i, "");
      const defaultName = `${baseName}_split.pdf`;

      setIsDialogOpen(true);
      const savePath = await promptSavePdf(defaultName);
      setIsDialogOpen(false);

      if (!savePath) return; // User canceled dialog

      setIsProcessing(true);
      const estimatedPages = countPagesFromRange(pageRange, targetFile.page_count);
      progressTracker = startProgressTracking("Splitting PDF", estimatedPages);

      const result = await invoke<string>("split_pdf", {
        inputPath: targetFile.path,
        pageRange,
        outputPath: savePath,
      });

      progressTracker.complete();
      showToast("success", result);
    } catch (err) {
      if (progressTracker) progressTracker.cancel();
      const errStr = String(err);
      if (errStr.includes("Output would overwrite a source file")) {
        showToast("error", "Output would overwrite a source file — choose a different name");
      } else {
        showToast("error", `Split failed: ${errStr}`);
      }
    } finally {
      setIsDialogOpen(false);
      setIsProcessing(false);
    }
  };

  // Compress Action
  const handleCompress = async (quality: CompressionQuality) => {
    if (isBusy) return;
    const targetFile = files[selectedFileIndex];
    if (!targetFile) {
      showToast("error", "Please select a PDF document to compress");
      return;
    }

    let progressTracker: { complete: () => void; cancel: () => void } | null = null;
    try {
      const baseName = targetFile.name.replace(/\.pdf$/i, "");
      const defaultName = `${baseName}_compressed.pdf`;

      setIsDialogOpen(true);
      const savePath = await promptSavePdf(defaultName);
      setIsDialogOpen(false);

      if (!savePath) return; // User canceled dialog

      // Enforce: Never overwrite the original file
      if (
        savePath.toLowerCase().trim() === targetFile.path.toLowerCase().trim()
      ) {
        showToast(
          "error",
          "Cannot overwrite the original PDF file. Please choose a different file name or location."
        );
        return;
      }

      setCompressError(null);
      setIsProcessing(true);
      progressTracker = startProgressTracking("Compressing PDF", targetFile.page_count);

      const result = await invoke<CompressResult>("compress_pdf", {
        inputPath: targetFile.path,
        quality,
        outputPath: savePath,
      });

      progressTracker.complete();
      setCompressResult(result);
      setCompressError(null);
      showToast(
        "success",
        `Compressed successfully! Reduced by ${result.percentage_saved.toFixed(1)}%`
      );
    } catch (err) {
      if (progressTracker) progressTracker.cancel();
      const errStr = String(err);
      setCompressResult(null);
      setCompressError(errStr);
      if (errStr.toLowerCase().includes("already well-compressed")) {
        showToast("info", "This PDF is already well-compressed. No further reduction possible.");
      } else {
        showToast("error", `Compression failed: ${errStr}`);
      }
    } finally {
      setIsDialogOpen(false);
      setIsProcessing(false);
    }
  };

  // Extract Text Action
  const handleExtractText = async () => {
    if (isBusy) return;
    const targetFile = files[selectedFileIndex];
    if (!targetFile) {
      showToast("error", "Please select a PDF document to extract text");
      return;
    }

    try {
      const baseName = targetFile.name.replace(/\.pdf$/i, "");
      const defaultName = `${baseName}_text.txt`;

      setIsDialogOpen(true);
      const savePath = await promptSaveTxt(defaultName);
      setIsDialogOpen(false);

      if (!savePath) return; // User canceled dialog

      setExtractTextError(null);
      setIsProcessing(true);
      const result = await invoke<ExtractTextResult>("extract_pdf_text", {
        inputPath: targetFile.path,
        outputPath: savePath,
      });

      setExtractTextResult(result);
      setExtractTextError(null);

      if (result.is_scanned) {
        showToast("info", "No selectable text found — this may be a scanned document.");
      } else {
        showToast(
          "success",
          `Extracted text from ${result.pages_processed} page${result.pages_processed === 1 ? "" : "s"} (${result.characters_extracted.toLocaleString()} characters)`
        );
      }
    } catch (err) {
      const errStr = String(err);
      setExtractTextResult(null);
      setExtractTextError(errStr);
      showToast("error", `Text extraction failed: ${errStr}`);
    } finally {
      setIsDialogOpen(false);
      setIsProcessing(false);
    }
  };

  // Extract Images Action
  const handleExtractImages = async () => {
    if (isBusy) return;
    const targetFile = files[selectedFileIndex];
    if (!targetFile) {
      showToast("error", "Please select a PDF document to extract images");
      return;
    }

    try {
      setIsDialogOpen(true);
      const folderPath = await promptPickFolder();
      setIsDialogOpen(false);

      if (!folderPath) return; // User canceled dialog

      setExtractImagesError(null);
      setIsProcessing(true);
      const result = await invoke<ExtractImagesResult>("extract_pdf_images", {
        inputPath: targetFile.path,
        outputFolder: folderPath,
      });

      setExtractImagesResult(result);
      setExtractImagesError(null);

      if (result.images_found === 0) {
        showToast("info", "No embedded images found in this PDF document");
      } else {
        showToast(
          "success",
          `Found and saved ${result.images_found} image${result.images_found === 1 ? "" : "s"} across ${result.pages_processed} page${result.pages_processed === 1 ? "" : "s"}`
        );
      }
    } catch (err) {
      const errStr = String(err);
      setExtractImagesResult(null);
      setExtractImagesError(errStr);
      showToast("error", `Image extraction failed: ${errStr}`);
    } finally {
      setIsDialogOpen(false);
      setIsProcessing(false);
    }
  };

  // Add Page Numbers Action
  const handlePageNumbers = async (options: PageNumberOptions) => {
    if (isBusy) return;
    const targetFile = files[selectedFileIndex];
    if (!targetFile) {
      showToast("error", "Please select a PDF document to add page numbers");
      return;
    }

    try {
      const baseName = targetFile.name.replace(/\.pdf$/i, "");
      const defaultName = `${baseName}_numbered.pdf`;

      setIsDialogOpen(true);
      const savePath = await promptSavePdf(defaultName);
      setIsDialogOpen(false);

      if (!savePath) return; // User canceled dialog

      // Overwrite guard: never overwrite the original
      if (savePath.toLowerCase().trim() === targetFile.path.toLowerCase().trim()) {
        showToast(
          "error",
          "Cannot overwrite the original PDF file. Please choose a different file name or location."
        );
        return;
      }

      setPageNumberError(null);
      setIsProcessing(true);

      const result = await invoke<PageNumberResult>("add_page_numbers", {
        inputPath: targetFile.path,
        outputPath: savePath,
        options: {
          position: options.position,
          font_size: options.font_size,
          start_number: options.start_number,
          format: options.format,
          margin: options.margin,
        },
      });

      setPageNumberResult(result);
      setPageNumberError(null);
      showToast(
        "success",
        `Successfully stamped page numbers on ${result.pages_processed} pages`
      );
    } catch (err) {
      const errStr = String(err);
      setPageNumberResult(null);
      setPageNumberError(errStr);
      showToast("error", `Adding page numbers failed: ${errStr}`);
    } finally {
      setIsDialogOpen(false);
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
            <span className="app-tagline">Fast, Private & Local PDF Utility</span>
          </div>
        </div>

        {/* Tab Navigation */}
        <nav className="tab-nav">
          <button
            className={`tab-button ${activeTab === "merge" ? "active" : ""}`}
            onClick={() => setActiveTab("merge")}
            disabled={isBusy}
          >
            Merge PDFs
          </button>
          <button
            className={`tab-button ${activeTab === "split" ? "active" : ""}`}
            onClick={() => setActiveTab("split")}
            disabled={isBusy}
          >
            Split PDF
          </button>
          <button
            className={`tab-button ${activeTab === "compress" ? "active" : ""}`}
            onClick={() => setActiveTab("compress")}
            disabled={isBusy}
          >
            Compress PDF
          </button>
          <button
            className={`tab-button ${activeTab === "extract-text" ? "active" : ""}`}
            onClick={() => setActiveTab("extract-text")}
            disabled={isBusy}
          >
            Extract Text
          </button>
          <button
            className={`tab-button ${activeTab === "extract-images" ? "active" : ""}`}
            onClick={() => setActiveTab("extract-images")}
            disabled={isBusy}
          >
            Extract Images
          </button>
          <button
            className={`tab-button ${activeTab === "page-numbers" ? "active" : ""}`}
            onClick={() => setActiveTab("page-numbers")}
            disabled={isBusy}
          >
            Add Page Numbers
          </button>
          <button
            className={`tab-button ${activeTab === "organize-pages" ? "active" : ""}`}
            onClick={() => setActiveTab("organize-pages")}
            disabled={isBusy}
          >
            Organize Pages
          </button>
        </nav>
      </header>

      {/* Two-Panel Workspace */}
      <div className="app-body">
        {/* Left Panel: Loaded Files */}
        <FileList
          files={files}
          selectedFileIndex={selectedFileIndex}
          onSelectFile={(idx) => {
            if (isBusy) return;
            setSelectedFileIndex(idx);
            clearAllResults();
          }}
          onAddFiles={handlePickFiles}
          onRemoveFile={(idx) => {
            if (isBusy) return;
            handleRemoveFile(idx);
            clearAllResults();
          }}
          onMoveUp={(idx) => {
            if (isBusy) return;
            handleMoveUp(idx);
          }}
          onMoveDown={(idx) => {
            if (isBusy) return;
            handleMoveDown(idx);
          }}
          onClearAll={() => {
            if (isBusy) return;
            handleClearAll();
            clearAllResults();
          }}
          isDragging={isDragging}
          setIsDragging={setIsDragging}
          onFilesDropped={handlePathsDropped}
          disabled={isBusy}
        />

        {/* Right Panel: Active Action Card */}
        <main className="right-panel">
          {activeTab === "merge" && (
            <MergePanel
              files={files}
              isProcessing={isBusy}
              onMerge={handleMerge}
              statusMessage={toast?.type === "success" ? toast.message : null}
              errorMessage={toast?.type === "error" ? toast.message : null}
            />
          )}
          {activeTab === "split" && (
            <SplitPanel
              files={files}
              selectedIndex={selectedFileIndex}
              onSelectFile={(idx) => {
                if (isBusy) return;
                setSelectedFileIndex(idx);
                clearAllResults();
              }}
              isProcessing={isBusy}
              onSplit={handleSplit}
              statusMessage={toast?.type === "success" ? toast.message : null}
              errorMessage={toast?.type === "error" ? toast.message : null}
            />
          )}
          {activeTab === "compress" && (
            <CompressPanel
              files={files}
              selectedIndex={selectedFileIndex}
              onSelectFile={(idx) => {
                if (isBusy) return;
                setSelectedFileIndex(idx);
                clearAllResults();
              }}
              isProcessing={isBusy}
              onCompress={handleCompress}
              compressResult={compressResult}
              onResetResult={() => setCompressResult(null)}
              compressError={compressError}
              onClearError={() => setCompressError(null)}
              statusMessage={toast?.type === "success" ? toast.message : null}
            />
          )}
          {activeTab === "extract-text" && (
            <ExtractTextPanel
              files={files}
              selectedIndex={selectedFileIndex}
              onSelectFile={(idx) => {
                if (isBusy) return;
                setSelectedFileIndex(idx);
                clearAllResults();
              }}
              isProcessing={isBusy}
              onExtractText={handleExtractText}
              extractResult={extractTextResult}
              onResetResult={() => setExtractTextResult(null)}
              errorMessage={extractTextError}
              onClearError={() => setExtractTextError(null)}
              statusMessage={toast?.type === "success" ? toast.message : null}
            />
          )}
          {activeTab === "extract-images" && (
            <ExtractImagesPanel
              files={files}
              selectedIndex={selectedFileIndex}
              onSelectFile={(idx) => {
                if (isBusy) return;
                setSelectedFileIndex(idx);
                clearAllResults();
              }}
              isProcessing={isBusy}
              onExtractImages={handleExtractImages}
              extractResult={extractImagesResult}
              onResetResult={() => setExtractImagesResult(null)}
              errorMessage={extractImagesError}
              onClearError={() => setExtractImagesError(null)}
              statusMessage={toast?.type === "success" ? toast.message : null}
            />
          )}
          {activeTab === "page-numbers" && (
            <PageNumbersPanel
              files={files}
              selectedIndex={selectedFileIndex}
              onSelectFile={(idx) => {
                if (isBusy) return;
                setSelectedFileIndex(idx);
                clearAllResults();
              }}
              isProcessing={isBusy}
              onAddPageNumbers={handlePageNumbers}
              onCancel={() => {
                clearAllResults();
                setActiveTab("merge");
              }}
              statusMessage={toast?.type === "success" ? toast.message : null}
              errorMessage={pageNumberError}
              pageNumberResult={pageNumberResult}
              onResetResult={() => setPageNumberResult(null)}
              onOpenDialog={() => !isBusy && setIsPageNumbersDialogOpen(true)}
            />
          )}
          {activeTab === "organize-pages" && (
            <OrganizePagesPanel
              files={files}
              selectedIndex={selectedFileIndex}
              onSelectFile={(idx) => {
                if (isBusy) return;
                setSelectedFileIndex(idx);
                clearAllResults();
              }}
              onSuccessToast={(msg) => showToast("success", msg)}
              onErrorToast={(msg) => showToast("error", msg)}
            />
          )}
        </main>
      </div>

      {/* Bottom Status Bar Area with Determinate Progress */}
      <footer className="app-status-bar" role="status" aria-live="polite">
        {operationProgress ? (
          <div className="status-bar-progress-container">
            <span className="status-bar-spinner" />
            <span className="status-bar-task-title">{operationProgress.title}:</span>
            <span className="status-bar-pages-count">
              {operationProgress.processedPages} / {operationProgress.totalPages} {operationProgress.totalPages === 1 ? "page" : "pages"}
            </span>
            <div
              className="status-bar-progress-track"
              role="progressbar"
              aria-valuenow={operationProgress.percentage}
              aria-valuemin={0}
              aria-valuemax={100}
            >
              <div
                className="status-bar-progress-fill"
                style={{ width: `${Math.min(100, Math.max(0, operationProgress.percentage))}%` }}
              />
            </div>
            <span className="status-bar-percentage">{operationProgress.percentage}%</span>
          </div>
        ) : (
          <div className="status-bar-idle">
            <span className="status-bar-dot" />
            <span>
              {files.length === 0
                ? "Ready — Drop or add PDF files to begin"
                : `${files.length} document${files.length > 1 ? "s" : ""} loaded (${files.reduce((a, b) => a + (b.page_count || 0), 0)} total pages) • Ready`}
            </span>
          </div>
        )}
        <div className="status-bar-meta">
          <span>Local Engine (Zero Cloud)</span>
        </div>
      </footer>

      {/* Optional Page Numbers Modal Dialog */}
      <PageNumbersDialog
        isOpen={isPageNumbersDialogOpen}
        onClose={() => setIsPageNumbersDialogOpen(false)}
        files={files}
        selectedIndex={selectedFileIndex}
        onSelectFile={(idx) => {
          if (isBusy) return;
          setSelectedFileIndex(idx);
          clearAllResults();
        }}
        isProcessing={isBusy}
        onAddPageNumbers={async (opts) => {
          await handlePageNumbers(opts);
          setIsPageNumbersDialogOpen(false);
        }}
      />
    </div>
  );
}

export default App;
