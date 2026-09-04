import React from "react";
import { PdfFileInfo, ExtractTextResult } from "../types/pdf";
import { formatBytes } from "../lib/format-bytes";

interface ExtractTextPanelProps {
  files: PdfFileInfo[];
  selectedIndex: number;
  onSelectFile: (index: number) => void;
  isProcessing: boolean;
  onExtractText: () => void;
  extractResult: ExtractTextResult | null;
  onResetResult: () => void;
  errorMessage: string | null;
  onClearError: () => void;
  statusMessage: string | null;
}

export const ExtractTextPanel: React.FC<ExtractTextPanelProps> = ({
  files,
  selectedIndex,
  onSelectFile,
  isProcessing,
  onExtractText,
  extractResult,
  onResetResult,
  errorMessage,
  onClearError,
  statusMessage,
}) => {
  const selectedFile: PdfFileInfo | undefined = files[selectedIndex];

  return (
    <div className="action-card">
      <div className="card-header">
        <h2 className="card-title">Extract Text</h2>
        <p className="card-description">
          Extract all readable text layers from the selected PDF and export as a clean UTF-8 text document with preserved page breaks.
        </p>
      </div>

      {files.length === 0 ? (
        <div className="info-callout">
          <span>👈 Load a PDF file on the left to extract its text.</span>
        </div>
      ) : (
        <div className="extract-content">
          {/* Target PDF Selector */}
          <div className="field-group">
            <label className="field-label">Target PDF Document:</label>
            <select
              className="select-input"
              value={selectedIndex}
              onChange={(e) => {
                onSelectFile(Number(e.target.value));
                if (extractResult) onResetResult();
                if (errorMessage) onClearError();
              }}
            >
              {files.map((file, idx) => (
                <option key={`opt-text-${file.path}-${idx}`} value={idx}>
                  {file.name} — {formatBytes(file.size)} ({file.page_count} {file.page_count === 1 ? "page" : "pages"})
                </option>
              ))}
            </select>
          </div>

          {/* Explanation Box */}
          <div className="extraction-info-box">
            <div className="extraction-info-header">
              <span className="info-icon">📄</span>
              <span className="info-title">Page Break Formatting</span>
            </div>
            <p className="extraction-info-text">
              Extracted text is partitioned cleanly by page with standard separator headers:
            </p>
            <code className="extraction-code-sample">----- Page N -----</code>
          </div>

          {/* Post-Extraction Result Summary */}
          {extractResult && (
            <div className="extract-result-panel">
              <div className="result-header">
                <div className="result-header-left">
                  <span className="result-success-icon">✓</span>
                  <div>
                    <h3 className="result-title">Text Extraction Summary</h3>
                    <span className="result-subtitle">
                      Exported to {extractResult.output_path.split(/[\\/]/).pop()}
                    </span>
                  </div>
                </div>
              </div>

              {/* Scanned Document Callout */}
              {extractResult.is_scanned ? (
                <div className="scanned-warning-banner">
                  <div className="scanned-warning-icon">⚠️</div>
                  <div className="scanned-warning-content">
                    <strong className="scanned-warning-title">
                      No selectable text found — this may be a scanned document.
                    </strong>
                    <p className="scanned-warning-desc">
                      The document pages contain no embedded font or vector text streams. Scanned PDFs require Optical Character Recognition (OCR) to convert raster page scans into selectable text.
                    </p>
                  </div>
                </div>
              ) : null}

              <div className="result-stats-grid">
                <div className="result-stat-box">
                  <span className="result-stat-label">Pages Processed</span>
                  <span className="result-stat-value">
                    {extractResult.pages_processed}
                  </span>
                </div>
                <div className="result-stat-box highlight">
                  <span className="result-stat-label">Characters Extracted</span>
                  <span className="result-stat-value">
                    {extractResult.characters_extracted.toLocaleString()}
                  </span>
                </div>
              </div>

              <div className="extracted-path-box">
                <span className="extracted-path-label">Destination File:</span>
                <span className="extracted-path-value" title={extractResult.output_path}>
                  {extractResult.output_path}
                </span>
              </div>

              <div className="result-actions">
                <button
                  type="button"
                  className="btn-secondary-sm"
                  onClick={onResetResult}
                >
                  Extract Another Document
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Error status banner */}
      {errorMessage && (
        <div className="alert-banner error">
          <span className="alert-icon">⚠️</span>
          <div className="alert-error-content">
            <span>{errorMessage}</span>
          </div>
          <button
            className="alert-dismiss-btn"
            onClick={onClearError}
            title="Dismiss error"
          >
            ✕
          </button>
        </div>
      )}

      {/* Success status banner */}
      {statusMessage && !extractResult && (
        <div className="alert-banner success">
          <span className="alert-icon">✓</span>
          <span>{statusMessage}</span>
        </div>
      )}

      <div className="card-footer">
        <button
          className="btn-primary-lg"
          disabled={!selectedFile || isProcessing}
          onClick={onExtractText}
        >
          {isProcessing ? "Extracting Text..." : "Extract Text & Save..."}
        </button>
      </div>
    </div>
  );
};
