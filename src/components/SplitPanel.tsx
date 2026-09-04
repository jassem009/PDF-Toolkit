import React, { useState, useEffect } from "react";
import { PdfFileInfo } from "../types/pdf";
import { parsePageRangeClient } from "../lib/page-range";

interface SplitPanelProps {
  files: PdfFileInfo[];
  selectedIndex: number;
  onSelectFile: (index: number) => void;
  isProcessing: boolean;
  onSplit: (range: string) => void;
  statusMessage: string | null;
  errorMessage: string | null;
}

export const SplitPanel: React.FC<SplitPanelProps> = ({
  files,
  selectedIndex,
  onSelectFile,
  isProcessing,
  onSplit,
  statusMessage,
  errorMessage,
}) => {
  const selectedFile: PdfFileInfo | undefined = files[selectedIndex];
  const [pageRange, setPageRange] = useState("1");

  // Adjust default range when selected file changes
  useEffect(() => {
    if (selectedFile) {
      if (selectedFile.page_count >= 5) {
        setPageRange("1-5");
      } else if (selectedFile.page_count > 1) {
        setPageRange(`1-${selectedFile.page_count}`);
      } else {
        setPageRange("1");
      }
    }
  }, [selectedIndex, selectedFile?.path, selectedFile?.page_count]);

  const validation = selectedFile
    ? parsePageRangeClient(pageRange, selectedFile.page_count)
    : { valid: false, pages: [] };

  const handlePreset = (preset: string) => {
    if (!selectedFile) return;
    if (preset === "all") {
      setPageRange(`1-${selectedFile.page_count}`);
    } else if (preset === "first") {
      setPageRange("1");
    } else if (preset === "first5") {
      setPageRange(`1-${Math.min(5, selectedFile.page_count)}`);
    } else if (preset === "odd") {
      const odds = Array.from({ length: selectedFile.page_count }, (_, i) => i + 1)
        .filter((n) => n % 2 !== 0)
        .join(",");
      setPageRange(odds);
    } else if (preset === "even") {
      const evens = Array.from({ length: selectedFile.page_count }, (_, i) => i + 1)
        .filter((n) => n % 2 === 0)
        .join(",");
      setPageRange(evens || "1");
    }
  };

  return (
    <div className="action-card">
      <div className="card-header">
        <h2 className="card-title">Split & Extract Pages</h2>
        <p className="card-description">
          Select a document and specify the page numbers or page range (e.g. 1-5, 8, 11-13) to export as a new PDF.
        </p>
      </div>

      {files.length === 0 ? (
        <div className="info-callout">
          <span>👈 Load a PDF file on the left to start splitting.</span>
        </div>
      ) : (
        <div className="split-content">
          <div className="field-group">
            <label className="field-label">Target PDF Document:</label>
            <select
              className="select-input"
              value={selectedIndex}
              onChange={(e) => onSelectFile(Number(e.target.value))}
            >
              {files.map((file, idx) => (
                <option key={`opt-${file.path}-${idx}`} value={idx}>
                  {file.name} ({file.page_count} {file.page_count === 1 ? "page" : "pages"})
                </option>
              ))}
            </select>
          </div>

          {selectedFile && (
            <>
              <div className="field-group">
                <div className="field-label-row">
                  <label className="field-label" htmlFor="page-range-input">
                    Page Range to Export:
                  </label>
                  <span className="field-hint">
                    Total: {selectedFile.page_count} {selectedFile.page_count === 1 ? "page" : "pages"}
                  </span>
                </div>

                <input
                  id="page-range-input"
                  type="text"
                  className={`text-input ${!validation.valid && pageRange.trim() ? "has-error" : ""}`}
                  placeholder="e.g. 1-5, 7, 9-12"
                  value={pageRange}
                  onChange={(e) => setPageRange(e.target.value)}
                />

                <div className="presets-row">
                  <span className="presets-label">Presets:</span>
                  <button
                    type="button"
                    className="preset-pill"
                    onClick={() => handlePreset("first")}
                  >
                    First Page (1)
                  </button>
                  {selectedFile.page_count >= 2 && (
                    <button
                      type="button"
                      className="preset-pill"
                      onClick={() => handlePreset("first5")}
                    >
                      Pages 1-{Math.min(5, selectedFile.page_count)}
                    </button>
                  )}
                  <button
                    type="button"
                    className="preset-pill"
                    onClick={() => handlePreset("all")}
                  >
                    All Pages (1-{selectedFile.page_count})
                  </button>
                </div>
              </div>

              <div className="preview-box">
                {validation.valid ? (
                  <div className="preview-valid">
                    <span className="preview-count">
                      ✓ Will export <strong>{validation.pages.length}</strong> {validation.pages.length === 1 ? "page" : "pages"}
                    </span>
                    <span className="preview-pages-list">
                      Pages: {validation.pages.length > 15
                        ? `${validation.pages.slice(0, 15).join(", ")}... (+${validation.pages.length - 15} more)`
                        : validation.pages.join(", ")}
                    </span>
                  </div>
                ) : (
                  <div className="preview-invalid">
                    <span>{validation.error || "Please enter a valid page range."}</span>
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      )}

      {statusMessage && (
        <div className="alert-banner success">
          <span className="alert-icon">✓</span>
          <span>{statusMessage}</span>
        </div>
      )}

      {errorMessage && (
        <div className="alert-banner error">
          <span className="alert-icon">⚠️</span>
          <span>{errorMessage}</span>
        </div>
      )}

      <div className="card-footer">
        <button
          className="btn-primary-lg"
          disabled={!selectedFile || !validation.valid || isProcessing}
          onClick={() => onSplit(pageRange)}
        >
          {isProcessing ? "Extracting Pages..." : "Split & Save..."}
        </button>
      </div>
    </div>
  );
};
