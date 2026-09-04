import { useState, useEffect, useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { PdfFileInfo, ActiveTab } from "./types/pdf";
import { FileList } from "./components/FileList";
import { MergePanel } from "./components/MergePanel";
import { SplitPanel } from "./components/SplitPanel";
import "./App.css";

export function App() {
  const [files, setFiles] = useState<PdfFileInfo[]>([]);
  const [selectedFileIndex, setSelectedFileIndex] = useState<number>(0);
  const [activeTab, setActiveTab] = useState<ActiveTab>("merge");
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Clear notifications when switching tabs or files
  const clearAlerts = useCallback(() => {
    setStatusMessage(null);
    setErrorMessage(null);
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
    clearAlerts();
  }, [clearAlerts]);

  // Handle native file picker dialog
  const handlePickFiles = async () => {
    try {
      clearAlerts();
      const picked = await invoke<PdfFileInfo[]>("pick_pdf_files");
      if (picked && picked.length > 0) {
        addFiles(picked);
      }
    } catch (err) {
      setErrorMessage(`Failed to pick files: ${String(err)}`);
    }
  };

  // Inspect paths dropped from desktop
  const handlePathsDropped = useCallback(async (paths: string[]) => {
    try {
      clearAlerts();
      const pdfPaths = paths.filter((p) => p.toLowerCase().endsWith(".pdf"));
      if (pdfPaths.length === 0) {
        setErrorMessage("Only .pdf files are supported.");
        return;
      }
      const inspected = await invoke<PdfFileInfo[]>("inspect_pdf_files", {
        paths: pdfPaths,
      });
      if (inspected && inspected.length > 0) {
        addFiles(inspected);
      }
    } catch (err) {
      setErrorMessage(`Failed to load dropped files: ${String(err)}`);
    }
  }, [addFiles, clearAlerts]);

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
    clearAlerts();
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
    clearAlerts();
  };

  const handleRemoveFile = (index: number) => {
    setFiles((prev) => prev.filter((_, i) => i !== index));
    setSelectedFileIndex((curr) => (curr >= index ? Math.max(0, curr - 1) : curr));
    clearAlerts();
  };

  const handleClearAll = () => {
    setFiles([]);
    setSelectedFileIndex(0);
    clearAlerts();
  };

  // Merge Action
  const handleMerge = async () => {
    if (files.length < 2) return;
    clearAlerts();

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

      setStatusMessage(result);
    } catch (err) {
      setErrorMessage(`Merge failed: ${String(err)}`);
    } finally {
      setIsProcessing(false);
    }
  };

  // Split Action
  const handleSplit = async (pageRange: string) => {
    const targetFile = files[selectedFileIndex];
    if (!targetFile) return;
    clearAlerts();

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

      setStatusMessage(result);
    } catch (err) {
      setErrorMessage(`Split failed: ${String(err)}`);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="app-container">
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
            onClick={() => {
              setActiveTab("merge");
              clearAlerts();
            }}
          >
            Merge PDFs
          </button>
          <button
            className={`tab-button ${activeTab === "split" ? "active" : ""}`}
            onClick={() => {
              setActiveTab("split");
              clearAlerts();
            }}
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
          onSelectFile={(idx) => {
            setSelectedFileIndex(idx);
            clearAlerts();
          }}
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
              statusMessage={statusMessage}
              errorMessage={errorMessage}
            />
          ) : (
            <SplitPanel
              files={files}
              selectedIndex={selectedFileIndex}
              onSelectFile={(idx) => {
                setSelectedFileIndex(idx);
                clearAlerts();
              }}
              isProcessing={isProcessing}
              onSplit={handleSplit}
              statusMessage={statusMessage}
              errorMessage={errorMessage}
            />
          )}
        </main>
      </div>
    </div>
  );
}

export default App;
