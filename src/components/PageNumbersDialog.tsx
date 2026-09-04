import React, { useState } from "react";
import { PdfFileInfo, PageNumberPosition, PageNumberOptions } from "../types/pdf";
import { evaluatePageNumberFormat } from "../lib/format-page-number";

interface PageNumbersDialogProps {
  isOpen: boolean;
  onClose: () => void;
  files: PdfFileInfo[];
  selectedIndex: number;
  onSelectFile: (index: number) => void;
  isProcessing: boolean;
  onAddPageNumbers: (options: PageNumberOptions) => void;
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

export const PageNumbersDialog: React.FC<PageNumbersDialogProps> = ({
  isOpen,
  onClose,
  files,
  selectedIndex,
  onSelectFile,
  isProcessing,
  onAddPageNumbers,
}) => {
  const selectedFile: PdfFileInfo | undefined = files[selectedIndex];

  // Options State
  const [position, setPosition] = useState<PageNumberPosition>("bottom-center");
  const [fontSize, setFontSize] = useState<number>(12);
  const [startNumber, setStartNumber] = useState<number>(1);
  const [format, setFormat] = useState<string>("Page X of Y");

  if (!isOpen) return null;

  const totalPages = selectedFile ? selectedFile.page_count : 1;
  const previewText = evaluatePageNumberFormat(format, startNumber, totalPages);

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
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className="modal-dialog page-numbers-modal"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-labelledby="dialog-title"
      >
        <div className="modal-header">
          <div className="modal-title-box">
            <h3 id="dialog-title" className="modal-title">
              Add Page Numbers
            </h3>
            <p className="modal-subtitle">Configure page numbering options with live first-page preview.</p>
          </div>
          <button
            type="button"
            className="modal-close-button"
            onClick={onClose}
            aria-label="Close dialog"
          >
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit} className="modal-body">
          {/* Target Document */}
          <div className="field-group">
            <label className="field-label" htmlFor="dialog-file-select">
              Selected Document:
            </label>
            <select
              id="dialog-file-select"
              className="select-input"
              value={selectedIndex}
              onChange={(e) => onSelectFile(Number(e.target.value))}
            >
              {files.map((file, idx) => (
                <option key={`dlg-file-${file.path}-${idx}`} value={idx}>
                  {file.name} ({file.page_count} {file.page_count === 1 ? "page" : "pages"})
                </option>
              ))}
            </select>
          </div>

          <div className="page-numbers-split-view">
            {/* Options Left */}
            <div className="options-column">
              {/* Visual Position Picker */}
              <div className="field-group">
                <label className="field-label">Position (Visual Picker):</label>
                <div className="visual-position-picker">
                  <div className="picker-page-sheet">
                    <div className="picker-row top-row">
                      {POSITION_OPTIONS.slice(0, 3).map((pos) => (
                        <button
                          key={`dlg-pos-${pos.id}`}
                          type="button"
                          className={`picker-node ${position === pos.id ? "active" : ""}`}
                          onClick={() => setPosition(pos.id)}
                          title={pos.label}
                          data-position={pos.id}
                        >
                          <span className="node-indicator" />
                          <span className="node-text">{pos.shortLabel}</span>
                        </button>
                      ))}
                    </div>

                    <div className="picker-sheet-interior">
                      <div className="interior-line line-1" />
                      <div className="interior-line line-2" />
                      <div className="interior-line line-3" />
                    </div>

                    <div className="picker-row bottom-row">
                      {POSITION_OPTIONS.slice(3, 6).map((pos) => (
                        <button
                          key={`dlg-pos-${pos.id}`}
                          type="button"
                          className={`picker-node ${position === pos.id ? "active" : ""}`}
                          onClick={() => setPosition(pos.id)}
                          title={pos.label}
                          data-position={pos.id}
                        >
                          <span className="node-indicator" />
                          <span className="node-text">{pos.shortLabel}</span>
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="position-chips-grid">
                    {POSITION_OPTIONS.map((pos) => (
                      <button
                        key={`dlg-chip-${pos.id}`}
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

              {/* Font Size Slider */}
              <div className="field-group">
                <div className="field-label-row">
                  <label className="field-label" htmlFor="dlg-font-size-slider">
                    Font Size:
                  </label>
                  <span className="font-size-badge">{fontSize} pt</span>
                </div>
                <div className="slider-container">
                  <input
                    id="dlg-font-size-slider"
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
                    <span onClick={() => setFontSize(12)}>12pt</span>
                    <span onClick={() => setFontSize(16)}>16pt</span>
                    <span onClick={() => setFontSize(24)}>24pt</span>
                  </div>
                </div>
              </div>

              {/* Start Numbering At */}
              <div className="field-group">
                <label className="field-label" htmlFor="dlg-start-number">
                  Start Numbering At:
                </label>
                <div className="number-input-row">
                  <input
                    id="dlg-start-number"
                    type="number"
                    min={1}
                    step={1}
                    value={startNumber}
                    onChange={(e) => setStartNumber(Math.max(1, parseInt(e.target.value, 10) || 1))}
                    className="number-input text-input"
                  />
                  <span className="input-hint">First page number</span>
                </div>
              </div>

              {/* Format */}
              <div className="field-group">
                <label className="field-label" htmlFor="dlg-format-input">
                  Page Number Format:
                </label>
                <div className="format-presets-row">
                  {FORMAT_PRESETS.map((preset) => (
                    <button
                      key={`dlg-fmt-${preset.value}`}
                      type="button"
                      className={`format-chip ${format === preset.value ? "active" : ""}`}
                      onClick={() => setFormat(preset.value)}
                    >
                      {preset.label}
                    </button>
                  ))}
                </div>
                <input
                  id="dlg-format-input"
                  type="text"
                  className="text-input format-input"
                  value={format}
                  onChange={(e) => setFormat(e.target.value)}
                  placeholder="e.g. Page X of Y"
                />
              </div>
            </div>

            {/* Live Preview Right */}
            <div className="preview-column">
              <div className="preview-header">
                <span className="preview-title">Live First-Page Preview</span>
                <span className="preview-badge">Page 1</span>
              </div>

              <div className="page-preview-card">
                <div className="preview-paper">
                  <div className="preview-doc-header">
                    <span className="preview-doc-title">
                      {selectedFile ? selectedFile.name : "Document.pdf"}
                    </span>
                  </div>

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
                Rendering <strong>{previewText}</strong> ({position.replace("-", " ")}, {fontSize}pt)
              </div>
            </div>
          </div>

          <div className="modal-footer dialog-actions-row">
            <button
              type="button"
              className="action-button secondary-button"
              onClick={onClose}
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
      </div>
    </div>
  );
};
