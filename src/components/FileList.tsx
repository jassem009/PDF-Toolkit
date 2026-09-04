import React, { useRef } from "react";
import { PdfFileInfo } from "../types/pdf";
import { formatBytes } from "../lib/format-bytes";

interface FileListProps {
  files: PdfFileInfo[];
  selectedFileIndex: number;
  onSelectFile: (index: number) => void;
  onAddFiles: () => void;
  onRemoveFile: (index: number) => void;
  onMoveUp: (index: number) => void;
  onMoveDown: (index: number) => void;
  onClearAll: () => void;
  isDragging: boolean;
  setIsDragging: (val: boolean) => void;
  onFilesDropped: (paths: string[]) => void;
}

export const FileList: React.FC<FileListProps> = ({
  files,
  selectedFileIndex,
  onSelectFile,
  onAddFiles,
  onRemoveFile,
  onMoveUp,
  onMoveDown,
  onClearAll,
  isDragging,
  setIsDragging,
}) => {
  const dropZoneRef = useRef<HTMLDivElement>(null);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  return (
    <aside
      ref={dropZoneRef}
      className={`left-panel ${isDragging ? "dragging" : ""}`}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
    >
      <div className="panel-header">
        <div className="panel-title-group">
          <span className="panel-title">Loaded Documents</span>
          <span className="count-badge">{files.length}</span>
        </div>
        <div className="panel-header-actions">
          {files.length > 0 && (
            <button
              className="btn-text danger"
              onClick={onClearAll}
              title="Remove all files"
            >
              Clear
            </button>
          )}
          <button className="btn-primary-sm" onClick={onAddFiles}>
            + Add PDFs
          </button>
        </div>
      </div>

      {files.length === 0 ? (
        <div className="empty-dropzone" onClick={onAddFiles}>
          <div className="dropzone-icon">📄</div>
          <p className="dropzone-text">
            <strong>Drop PDF files here</strong> or click to browse
          </p>
          <span className="dropzone-sub">Supports multiple .pdf files</span>
        </div>
      ) : (
        <div className="files-scroll-container">
          <ul className="file-items-list">
            {files.map((file, index) => {
              const isSelected = index === selectedFileIndex;
              return (
                <li
                  key={`${file.path}-${index}`}
                  className={`file-item ${isSelected ? "selected" : ""}`}
                  onClick={() => onSelectFile(index)}
                >
                  <div className="file-item-left">
                    <span className="file-index">{index + 1}</span>
                    <div className="file-icon-badge">PDF</div>
                    <div className="file-details">
                      <span className="file-name" title={file.path}>
                        {file.name}
                      </span>
                      <div className="file-meta">
                        <span className="meta-badge pages">
                          {file.page_count} {file.page_count === 1 ? "page" : "pages"}
                        </span>
                        <span className="meta-badge size">
                          {formatBytes(file.size)}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div
                    className="file-item-actions"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <button
                      className="btn-icon"
                      disabled={index === 0}
                      onClick={() => onMoveUp(index)}
                      title="Move up"
                    >
                      ▲
                    </button>
                    <button
                      className="btn-icon"
                      disabled={index === files.length - 1}
                      onClick={() => onMoveDown(index)}
                      title="Move down"
                    >
                      ▼
                    </button>
                    <button
                      className="btn-icon remove"
                      onClick={() => onRemoveFile(index)}
                      title="Remove file"
                    >
                      ✕
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>

          <div className="compact-drop-reminder" onClick={onAddFiles}>
            <span>+ Add more PDFs</span>
          </div>
        </div>
      )}
    </aside>
  );
};
