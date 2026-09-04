import React from "react";
import { PdfFileInfo } from "../types/pdf";

interface MergePanelProps {
  files: PdfFileInfo[];
  isProcessing: boolean;
  onMerge: () => void;
  statusMessage: string | null;
  errorMessage: string | null;
}

export const MergePanel: React.FC<MergePanelProps> = ({
  files,
  isProcessing,
  onMerge,
  statusMessage,
  errorMessage,
}) => {
  const totalPages = files.reduce((acc, f) => acc + f.page_count, 0);
  const canMerge = files.length >= 2;

  return (
    <div className="action-card">
      <div className="card-header">
        <h2 className="card-title">Merge PDF Files</h2>
        <p className="card-description">
          Combine multiple documents into a single PDF. Files will be merged in the order listed on the left.
        </p>
      </div>

      <div className="merge-overview">
        <div className="stat-boxes">
          <div className="stat-box">
            <span className="stat-label">Files to Merge</span>
            <span className="stat-value">{files.length}</span>
          </div>
          <div className="stat-box">
            <span className="stat-label">Total Output Pages</span>
            <span className="stat-value">{totalPages}</span>
          </div>
        </div>

        {files.length > 0 ? (
          <div className="sequence-preview">
            <span className="sequence-title">Merge Sequence Preview:</span>
            <ol className="sequence-list">
              {files.map((file, i) => (
                <li key={`seq-${file.path}-${i}`} className="sequence-item">
                  <span className="seq-number">{i + 1}.</span>
                  <span className="seq-name">{file.name}</span>
                  <span className="seq-pages">({file.page_count} {file.page_count === 1 ? "page" : "pages"})</span>
                </li>
              ))}
            </ol>
          </div>
        ) : (
          <div className="info-callout">
            <span>👈 Load PDF files using the left panel to begin merging.</span>
          </div>
        )}

        {!canMerge && files.length === 1 && (
          <div className="warning-callout">
            <span>⚠️ Please add at least 1 more PDF file to perform a merge.</span>
          </div>
        )}
      </div>

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
          disabled={!canMerge || isProcessing}
          onClick={onMerge}
        >
          {isProcessing ? "Merging Documents..." : "Merge & Save..."}
        </button>
      </div>
    </div>
  );
};
