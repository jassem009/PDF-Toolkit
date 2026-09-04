import React, { useState } from "react";
import { PdfFileInfo, CompressionQuality, CompressResult } from "../types/pdf";
import { formatBytes } from "../lib/format-bytes";

interface CompressPanelProps {
  files: PdfFileInfo[];
  selectedIndex: number;
  onSelectFile: (index: number) => void;
  isProcessing: boolean;
  onCompress: (quality: CompressionQuality) => void;
  compressResult: CompressResult | null;
  onResetResult: () => void;
  statusMessage: string | null;
  errorMessage: string | null;
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
    details: "Aggressive compression (JPEG ~35, 1200px max). Ideal for email attachments and rapid sharing.",
  },
  {
    id: "medium",
    title: "Medium Quality",
    badge: "Recommended",
    shortDesc: "Balanced size & clear quality",
    details: "Optimal balance (JPEG ~65, 2000px max). Drastically reduces size while retaining text and image clarity.",
  },
  {
    id: "high",
    title: "High Quality",
    shortDesc: "Highest quality, mild compression",
    details: "Preserves crisp fine details (JPEG ~85, full resolution). Perfect for archival and professional printing.",
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
  statusMessage,
  errorMessage,
}) => {
  const [selectedQuality, setSelectedQuality] = useState<CompressionQuality>("medium");
  const selectedFile: PdfFileInfo | undefined = files[selectedIndex];

  const handleQualityChange = (quality: CompressionQuality) => {
    setSelectedQuality(quality);
    if (compressResult) {
      onResetResult();
    }
  };

  const isWellCompressedMessage =
    errorMessage && errorMessage.toLowerCase().includes("already well-compressed");

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
              <span className="field-hint">Select balance of size vs clarity</span>
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
                    <p className="quality-details-desc">{opt.details}</p>
                  </div>
                );
              })}
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

      {/* Already Well-Compressed Alert */}
      {isWellCompressedMessage && (
        <div className="alert-banner info well-compressed-banner">
          <span className="alert-icon">ℹ️</span>
          <div>
            <strong>This PDF is already well-compressed.</strong>
            <p className="well-compressed-text">
              Its images and data streams are already optimally encoded. Exporting further would not reduce size without corrupting clarity.
            </p>
          </div>
        </div>
      )}

      {/* General Success/Error Status */}
      {statusMessage && !compressResult && (
        <div className="alert-banner success">
          <span className="alert-icon">✓</span>
          <span>{statusMessage}</span>
        </div>
      )}

      {errorMessage && !isWellCompressedMessage && (
        <div className="alert-banner error">
          <span className="alert-icon">⚠️</span>
          <span>{errorMessage}</span>
        </div>
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
