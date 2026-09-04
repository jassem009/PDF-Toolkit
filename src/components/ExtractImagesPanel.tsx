import React from "react";
import { PdfFileInfo, ExtractImagesResult } from "../types/pdf";
import { formatBytes } from "../lib/format-bytes";

interface ExtractImagesPanelProps {
  files: PdfFileInfo[];
  selectedIndex: number;
  onSelectFile: (index: number) => void;
  isProcessing: boolean;
  onExtractImages: () => void;
  extractResult: ExtractImagesResult | null;
  onResetResult: () => void;
  errorMessage: string | null;
  onClearError: () => void;
  statusMessage: string | null;
}

export const ExtractImagesPanel: React.FC<ExtractImagesPanelProps> = ({
  files,
  selectedIndex,
  onSelectFile,
  isProcessing,
  onExtractImages,
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
        <h2 className="card-title">Extract Images</h2>
        <p className="card-description">
          Extract all embedded raster and photograph images from the PDF into an output directory with automatic naming and original format preservation.
        </p>
      </div>

      {files.length === 0 ? (
        <div className="info-callout">
          <span>👈 Load a PDF file on the left to extract its images.</span>
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
                <option key={`opt-img-${file.path}-${idx}`} value={idx}>
                  {file.name} — {formatBytes(file.size)} ({file.page_count} {file.page_count === 1 ? "page" : "pages"})
                </option>
              ))}
            </select>
          </div>

          {/* Extraction Info Box */}
          <div className="extraction-info-box">
            <div className="extraction-info-header">
              <span className="info-icon">🖼️</span>
              <span className="info-title">Naming & Format Preservation</span>
            </div>
            <p className="extraction-info-text">
              Images are extracted with structured filenames identifying the document and page:
            </p>
            <code className="extraction-code-sample">
              {selectedFile
                ? `${selectedFile.name.replace(/\.pdf$/i, "")}_p1_img1.png / .jpg`
                : "docname_p1_img1.png / .jpg"}
            </code>
            <p className="extraction-info-subtext">
              Original stream encodings are preserved (DCT streams saved directly as .jpg, lossless Flate streams as .png).
            </p>
          </div>

          {/* Post-Extraction Result Summary */}
          {extractResult && (
            <div className="extract-result-panel">
              <div className="result-header">
                <div className="result-header-left">
                  <span className="result-success-icon">✓</span>
                  <div>
                    <h3 className="result-title">Image Extraction Summary</h3>
                    <span className="result-subtitle">
                      Saved to {extractResult.output_folder.split(/[\\/]/).pop() || extractResult.output_folder}
                    </span>
                  </div>
                </div>
                <div className="images-count-badge">
                  {extractResult.images_found}{" "}
                  {extractResult.images_found === 1 ? "Image" : "Images"} Found
                </div>
              </div>

              <div className="result-stats-grid">
                <div className="result-stat-box">
                  <span className="result-stat-label">Pages Processed</span>
                  <span className="result-stat-value">
                    {extractResult.pages_processed}
                  </span>
                </div>
                <div className="result-stat-box highlight">
                  <span className="result-stat-label">Images Extracted</span>
                  <span className="result-stat-value">
                    {extractResult.images_found}
                  </span>
                </div>
              </div>

              {extractResult.images_found === 0 ? (
                <div className="info-callout" style={{ marginTop: "1rem" }}>
                  <span>ℹ️ No embedded images found in this PDF document.</span>
                </div>
              ) : (
                <div className="extracted-files-section">
                  <span className="extracted-files-label">Extracted Image Files:</span>
                  <div className="extracted-files-list">
                    {extractResult.extracted_files.map((file, idx) => (
                      <div key={`ext-img-${idx}`} className="extracted-file-item">
                        <span className="file-item-icon">📷</span>
                        <span className="file-item-name" title={file}>
                          {file}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="extracted-path-box">
                <span className="extracted-path-label">Destination Folder:</span>
                <span className="extracted-path-value" title={extractResult.output_folder}>
                  {extractResult.output_folder}
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
          onClick={onExtractImages}
        >
          {isProcessing ? "Extracting Images..." : "Choose Folder & Extract Images..."}
        </button>
      </div>
    </div>
  );
};
