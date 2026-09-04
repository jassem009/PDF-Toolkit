import React, { useState } from "react";
import { PdfFileInfo, PageNumberPosition, PageNumberOptions, PageNumberResult } from "../types/pdf";
import { evaluatePageNumberFormat } from "../lib/format-page-number";
import { AlertBanner } from "./AlertBanner";

interface PageNumbersPanelProps {
  files: PdfFileInfo[];
  selectedIndex: number;
  onSelectFile: (index: number) => void;
  isProcessing: boolean;
  onAddPageNumbers: (options: PageNumberOptions) => void;
  onCancel: () => void;
  statusMessage: string | null;
  errorMessage: string | null;
  pageNumberResult: PageNumberResult | null;
  onResetResult: () => void;
  onOpenDialog: () => void;
}

const POSITION_OPTIONS: { id: PageNumberPosition; label: string; shortLabel: string }[] = [
  { id: "top-left", label: "Top Left", shortLabel: "TL" },
  { id: "top-center", label: "Top Center", shortLabel: "TC" },
  { id: "top-right", label: "Top Right", shortLabel: "TR" },
  { id: "bottom-left", label: "Bottom Left", shortLabel: "BL" },
  { id: "bottom-center", label: "Bottom Center", shortLabel: "BC" },
  { id: "bottom-right", label: "Bottom Right", shortLabel: "BR" },
];

const FORMAT_PRESETS = [
  { label: "Page X of Y", value: "Page X of Y" },
  { label: "Just X", value: "X" },
  { label: "Page X", value: "Page X" },
  { label: "X / Y", value: "X / Y" },
  { label: "- X -", value: "- X -" },
];

export const PageNumbersPanel: React.FC<PageNumbersPanelProps> = ({
  files,
  selectedIndex,
  onSelectFile,
  isProcessing,
  onAddPageNumbers,
  onCancel,
  statusMessage,
  errorMessage,
  pageNumberResult,
  onResetResult,
  onOpenDialog,
}) => {
  const selectedFile: PdfFileInfo | undefined = files[selectedIndex];

  // Form State
  const [position, setPosition] = useState<PageNumberPosition>("bottom-center");
  const [fontSize, setFontSize] = useState<number>(12);
  const [startNumber, setStartNumber] = useState<number>(1);
  const [format, setFormat] = useState<string>("Page X of Y");

  // Calculate live preview text for page 1
  const totalPages = selectedFile ? selectedFile.page_count : 1;
  const previewText = evaluatePageNumberFormat(format, startNumber, totalPages, startNumber);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedFile) return;

    onAddPageNumbers({
      position,
      font_size: fontSize,
      start_number: Math.max(1, startNumber),
      format: format.trim() || "X",
      margin: 36,
    });
  };

  return (
    <div className="action-card page-numbers-card">
      <div className="card-header">
        <div className="header-title-row">
          <div className="title-with-badge">
            <h2 className="card-title">Add Page Numbers</h2>
            <span className="card-badge">Stamping</span>
          </div>
          {files.length > 0 && (
            <button
              type="button"
              className="secondary-button"
              style={{ fontSize: "11px", padding: "4px 10px" }}
              onClick={onOpenDialog}
              title="Open full configuration in a modal dialog"
            >
              ⛶ Modal View
            </button>
          )}
        </div>
        <p className="card-description">
          Stamp customizable page numbers onto each page with interactive positioning, font controls, and live first-page preview.
        </p>
      </div>

      {files.length === 0 ? (
        <div className="info-callout">
          <span>👈 Load a PDF document on the left to configure page numbers.</span>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="page-numbers-content">
          {/* Target PDF Selector */}
          <div className="field-group">
            <label className="field-label" htmlFor="target-file-select">
              Target PDF Document:
            </label>
            <select
              id="target-file-select"
              className="select-input"
              value={selectedIndex}
              onChange={(e) => {
                onSelectFile(Number(e.target.value));
                if (pageNumberResult) onResetResult();
              }}
            >
              {files.map((file, idx) => (
                <option key={`opt-${file.path}-${idx}`} value={idx}>
                  {file.name} ({file.page_count} {file.page_count === 1 ? "page" : "pages"})
                </option>
              ))}
            </select>
          </div>

          {/* Configuration Grid: Left Controls, Right Live Preview */}
          <div className="page-numbers-split-view">
            {/* Options Column */}
            <div className="options-column">
              {/* 1. Visual Position Picker */}
              <div className="field-group">
                <label className="field-label">
                  Position <span className="field-sublabel">(Visual Picker)</span>:
                </label>
                <div className="visual-position-picker" role="radiogroup" aria-label="Page number position">
                  <div className="picker-page-sheet">
                    {/* Top Row Positions */}
                    <div className="picker-row top-row">
                      {POSITION_OPTIONS.slice(0, 3).map((pos) => (
                        <button
                          key={pos.id}
                          type="button"
                          className={`picker-node ${position === pos.id ? "active" : ""}`}
                          onClick={() => setPosition(pos.id)}
                          title={pos.label}
                          data-position={pos.id}
                          aria-checked={position === pos.id}
                          role="radio"
                        >
                          <span className="node-indicator" />
                          <span className="node-text">{pos.shortLabel}</span>
                        </button>
                      ))}
                    </div>

                    {/* Page Interior Watermark */}
                    <div className="picker-sheet-interior">
                      <div className="interior-line line-1" />
                      <div className="interior-line line-2" />
                      <div className="interior-line line-3" />
                    </div>

                    {/* Bottom Row Positions */}
                    <div className="picker-row bottom-row">
                      {POSITION_OPTIONS.slice(3, 6).map((pos) => (
                        <button
                          key={pos.id}
                          type="button"
                          className={`picker-node ${position === pos.id ? "active" : ""}`}
                          onClick={() => setPosition(pos.id)}
                          title={pos.label}
                          data-position={pos.id}
                          aria-checked={position === pos.id}
                          role="radio"
                        >
                          <span className="node-indicator" />
                          <span className="node-text">{pos.shortLabel}</span>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Position Chips for fast text confirmation */}
                  <div className="position-chips-grid">
                    {POSITION_OPTIONS.map((pos) => (
                      <button
                        key={`chip-${pos.id}`}
                        type="button"
                        className={`position-chip ${position === pos.id ? "active" : ""}`}
                        onClick={() => setPosition(pos.id)}
                      >
                        {pos.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* 2. Font Size Slider (8 - 24pt) */}
              <div className="field-group">
                <div className="field-label-row">
                  <label className="field-label" htmlFor="font-size-slider">
                    Font Size:
                  </label>
                  <span className="font-size-badge">{fontSize} pt</span>
                </div>
                <div className="slider-container">
                  <input
                    id="font-size-slider"
                    type="range"
                    min={8}
                    max={24}
                    step={1}
                    value={fontSize}
                    onChange={(e) => setFontSize(Number(e.target.value))}
                    className="range-slider"
                  />
                  <div className="slider-ticks">
                    <span onClick={() => setFontSize(8)}>8pt</span>
                    <span onClick={() => setFontSize(10)}>10pt</span>
                    <span onClick={() => setFontSize(12)}>12pt</span>
                    <span onClick={() => setFontSize(16)}>16pt</span>
                    <span onClick={() => setFontSize(24)}>24pt</span>
                  </div>
                </div>
              </div>

              {/* 3. Start Numbering At */}
              <div className="field-group">
                <label className="field-label" htmlFor="start-number-input">
                  Start Numbering At:
                </label>
                <div className="number-input-row">
                  <input
                    id="start-number-input"
                    type="number"
                    min={1}
                    step={1}
                    value={startNumber}
                    onChange={(e) => setStartNumber(Math.max(1, parseInt(e.target.value, 10) || 1))}
                    className="number-input text-input"
                  />
                  <span className="input-hint">First page display number</span>
                </div>
              </div>

              {/* 4. Format Selector & Custom Format */}
              <div className="field-group">
                <label className="field-label" htmlFor="format-template-input">
                  Page Number Format:
                </label>
                <div className="format-presets-row">
                  {FORMAT_PRESETS.map((preset) => (
                    <button
                      key={preset.value}
                      type="button"
                      className={`format-chip ${format === preset.value ? "active" : ""}`}
                      onClick={() => setFormat(preset.value)}
                    >
                      {preset.label}
                    </button>
                  ))}
                </div>
                <input
                  id="format-template-input"
                  type="text"
                  className="text-input format-input"
                  value={format}
                  onChange={(e) => setFormat(e.target.value)}
                  placeholder="e.g. Page X of Y or X"
                />
                <span className="input-hint">
                  Use <strong>X</strong> for page number, <strong>Y</strong> for total pages (e.g. "Page X of Y", "X", or "- X -").
                </span>
              </div>
            </div>

            {/* Live Preview Column */}
            <div className="preview-column">
              <div className="preview-header">
                <span className="preview-title">Live First-Page Preview</span>
                <span className="preview-badge">Page 1</span>
              </div>

              <div className="page-preview-card">
                {/* Simulated Paper Canvas */}
                <div className="preview-paper">
                  {/* Document Title Header in Preview */}
                  <div className="preview-doc-header">
                    <span className="preview-doc-title">
                      {selectedFile ? selectedFile.name : "Document.pdf"}
                    </span>
                  </div>

                  {/* Simulated Content Skeleton Lines */}
                  <div className="preview-content-skeleton">
                    <div className="skeleton-bar h-lg w-75" />
                    <div className="skeleton-bar h-sm w-100" />
                    <div className="skeleton-bar h-sm w-90" />
                    <div className="skeleton-bar h-sm w-95" />
                    <div className="skeleton-bar h-sm w-80" />
                    <div className="skeleton-divider" />
                    <div className="skeleton-bar h-sm w-85" />
                    <div className="skeleton-bar h-sm w-90" />
                    <div className="skeleton-bar h-sm w-60" />
                  </div>

                  {/* Dynamic Page Number Element Positioned Live */}
                  <div
                    className={`preview-page-number pos-${position}`}
                    style={{
                      fontSize: `${Math.max(9, Math.round(fontSize * 0.85))}px`,
                    }}
                  >
                    <span className="number-tag">{previewText}</span>
                  </div>
                </div>
              </div>
              <div className="preview-caption">
                Rendering <strong>{previewText}</strong> at <strong>{position.replace("-", " ")}</strong> ({fontSize}pt)
              </div>
            </div>
          </div>

          {/* Success / Error Banners */}
          <AlertBanner type="success" message={statusMessage} />
          <AlertBanner type="error" message={errorMessage} />

          {/* Result Panel */}
          {pageNumberResult && (
            <div className="result-panel">
              <div className="result-header">
                <span className="result-title">Page Numbering Complete</span>
                <span className="result-badge">Saved</span>
              </div>
              <p className="result-summary">
                Successfully stamped page numbers on all {pageNumberResult.pages_processed} pages.
              </p>
              <div className="result-path-box">
                <span className="result-path-label">Destination:</span>
                <span className="result-path-value">{pageNumberResult.output_path}</span>
              </div>
            </div>
          )}

          {/* Action Footer */}
          <div className="dialog-actions-row">
            <button
              type="button"
              className="action-button secondary-button"
              onClick={onCancel}
              disabled={isProcessing}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="action-button primary-button"
              disabled={isProcessing || !selectedFile}
            >
              {isProcessing ? "Stamping Page Numbers..." : "Add Page Numbers & Export..."}
            </button>
          </div>
        </form>
      )}
    </div>
  );
};
