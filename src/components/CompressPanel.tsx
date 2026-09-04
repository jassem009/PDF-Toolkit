import React, { useState } from "react";
import { PdfFileInfo, CompressionQuality, CompressResult } from "../types/pdf";
import { formatBytes } from "../lib/format-bytes";
import { AlertBanner } from "./AlertBanner";

interface CompressPanelProps {
  files: PdfFileInfo[];
  selectedIndex: number;
  onSelectFile: (index: number) => void;
  isProcessing: boolean;
  onCompress: (quality: CompressionQuality) => void;
  compressResult: CompressResult | null;
  onResetResult: () => void;
  compressError: string | null;
  onClearError: () => void;
  statusMessage: string | null;
}

interface QualityOption {
  id: CompressionQuality;
  title: string;
  badge?: string;
  shortDesc: string;
  details: string;
}

const QUALITY_OPTIONS: QualityOption[] = [
  {
    id: "low",
    title: "Low Quality",
    shortDesc: "Smallest size, lower quality",
    details: "Aggressive compression (JPEG ~35, 1200px max). Ideal for email attachments, chats, and rapid transfers where minimum file size is crucial.",
  },
  {
    id: "medium",
    title: "Medium Quality",
    badge: "Recommended",
    shortDesc: "Balanced size & clear quality",
    details: "Optimal balance (JPEG ~65, 2000px max). Drastically reduces size while retaining sharp text, graphics, and high-fidelity photo clarity.",
  },
  {
    id: "high",
    title: "High Quality",
    shortDesc: "Highest quality, mild compression",
    details: "Preserves crisp fine details (JPEG ~85, full resolution). Perfect for official presentations, client documents, and print archival.",
  },
];

export const CompressPanel: React.FC<CompressPanelProps> = ({
  files,
  selectedIndex,
  onSelectFile,
  isProcessing,
  onCompress,
  compressResult,
  onResetResult,
  compressError,
  onClearError,
  statusMessage,
}) => {
  const [selectedQuality, setSelectedQuality] = useState<CompressionQuality>("medium");
  const selectedFile: PdfFileInfo | undefined = files[selectedIndex];

  const selectedOption =
    QUALITY_OPTIONS.find((opt) => opt.id === selectedQuality) || QUALITY_OPTIONS[1];

  const handleQualityChange = (quality: CompressionQuality) => {
    setSelectedQuality(quality);
    if (compressResult) {
      onResetResult();
    }
    if (compressError) {
      onClearError();
    }
  };

  const isWellCompressedMessage =
    compressError && compressError.toLowerCase().includes("already well-compressed");

  return (
    <div className="action-card">
      <div className="card-header">
        <h2 className="card-title">Compress PDF</h2>
        <p className="card-description">
          Reduce document file size by re-encoding embedded images and optimizing internal PDF streams.
        </p>
      </div>

      {files.length === 0 ? (
        <div className="info-callout">
          <span>👈 Load a PDF file on the left to start compression.</span>
        </div>
      ) : (
        <div className="compress-content">
          {/* Target PDF Selector */}
          <div className="field-group">
            <label className="field-label">Target PDF Document:</label>
            <select
              className="select-input"
              value={selectedIndex}
              onChange={(e) => {
                onSelectFile(Number(e.target.value));
                if (compressResult) onResetResult();
                if (compressError) onClearError();
              }}
            >
              {files.map((file, idx) => (
                <option key={`opt-${file.path}-${idx}`} value={idx}>
                  {file.name} — {formatBytes(file.size)} ({file.page_count} {file.page_count === 1 ? "page" : "pages"})
                </option>
              ))}
            </select>
          </div>

          {/* Quality Levels Selection */}
          <div className="field-group">
            <div className="field-label-row">
              <label className="field-label">Choose Compression Level:</label>
              <span className="field-hint">Click a level to view details</span>
            </div>

            <div className="quality-cards-grid">
              {QUALITY_OPTIONS.map((opt) => {
                const isSelected = selectedQuality === opt.id;
                return (
                  <div
                    key={opt.id}
                    className={`quality-card ${isSelected ? "selected" : ""}`}
                    onClick={() => handleQualityChange(opt.id)}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        handleQualityChange(opt.id);
                      }
                    }}
                  >
                    <div className="quality-card-top">
                      <div className="quality-radio-indicator">
                        <div className={`radio-dot ${isSelected ? "checked" : ""}`} />
                      </div>
                      <div className="quality-card-header-text">
                        <span className="quality-card-title">{opt.title}</span>
                        {opt.badge && <span className="quality-badge">{opt.badge}</span>}
                      </div>
                    </div>
                    <p className="quality-short-desc">{opt.shortDesc}</p>
                  </div>
                );
              })}
            </div>

            {/* Dynamic Active Quality Explanation */}
            <div
              className="active-quality-explanation"
              key={`desc-${selectedOption.id}`}
              role="region"
              aria-live="polite"
            >
              <div className="active-quality-header">
                <div className="active-quality-header-left">
                  <span className="active-quality-icon">⚡</span>
                  <span className="active-quality-name">
                    {selectedOption.title} Settings
                  </span>
                </div>
                {selectedOption.badge && (
                  <span className="quality-badge">{selectedOption.badge}</span>
                )}
              </div>
              <p className="active-quality-summary">
                {selectedOption.shortDesc}
              </p>
              <p className="active-quality-details">
                {selectedOption.details}
              </p>
            </div>
          </div>

          {/* Post-Compression Result Panel */}
          {compressResult && (
            <div className="compress-result-panel">
              <div className="result-header">
                <div className="result-header-left">
                  <span className="result-success-icon">✓</span>
                  <div>
                    <h3 className="result-title">Compression Successful</h3>
                    <span className="result-subtitle">
                      Saved to {compressResult.output_path.split(/[\\/]/).pop()}
                    </span>
                  </div>
                </div>
                <div className="savings-badge">
                  {compressResult.percentage_saved.toFixed(1)}% Saved
                </div>
              </div>

              <div className="result-stats-grid">
                <div className="result-stat-box">
                  <span className="result-stat-label">Original Size</span>
                  <span className="result-stat-value original">
                    {formatBytes(compressResult.original_size)}
                  </span>
                </div>
                <div className="result-stat-arrow">➔</div>
                <div className="result-stat-box highlight">
                  <span className="result-stat-label">New Size</span>
                  <span className="result-stat-value compressed">
                    {formatBytes(compressResult.compressed_size)}
                  </span>
                </div>
                <div className="result-stat-box">
                  <span className="result-stat-label">Total Saved</span>
                  <span className="result-stat-value saved">
                    {formatBytes(compressResult.bytes_saved)}
                  </span>
                </div>
              </div>

              {compressResult.images_compressed > 0 && (
                <div className="result-images-note">
                  📷 <strong>{compressResult.images_compressed}</strong> embedded{" "}
                  {compressResult.images_compressed === 1 ? "image was" : "images were"}{" "}
                  re-encoded and optimized.
                </div>
              )}

              <div className="result-actions">
                <button
                  type="button"
                  className="btn-secondary-sm"
                  onClick={onResetResult}
                >
                  Compress Again
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Persistent Inline Well-Compressed Alert */}
      {isWellCompressedMessage && (
        <AlertBanner
          type="info"
          className="well-compressed-banner"
          onDismiss={onClearError}
        >
          <div className="well-compressed-content">
            <strong>This PDF is already well-compressed.</strong>
            <p className="well-compressed-text">
              Its images and data streams are already optimally encoded. Exporting further would not reduce size without corrupting clarity.
            </p>
          </div>
        </AlertBanner>
      )}

      {/* Persistent General Error Status */}
      {compressError && !isWellCompressedMessage && (
        <AlertBanner
          type="error"
          message={compressError}
          onDismiss={onClearError}
        />
      )}

      {/* General Success Status Message */}
      {statusMessage && !compressResult && (
        <AlertBanner type="success" message={statusMessage} />
      )}

      <div className="card-footer">
        <button
          className="btn-primary-lg"
          disabled={!selectedFile || isProcessing}
          onClick={() => onCompress(selectedQuality)}
        >
          {isProcessing ? "Compressing Document..." : "Compress & Save..."}
        </button>
      </div>
    </div>
  );
};
