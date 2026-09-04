import React, { useState, useEffect, useCallback, useMemo } from "react";
import { invoke } from "@tauri-apps/api/core";
import {
  PdfFileInfo,
  PageItemState,
  PageDetails,
  PageOrganizeAction,
  OrganizePagesResult,
} from "../types/pdf";
import { LazyPageThumbnail } from "./LazyPageThumbnail";
import { DeletePagesConfirmDialog } from "./DeletePagesConfirmDialog";

interface OrganizePagesPanelProps {
  files: PdfFileInfo[];
  selectedIndex: number;
  onSelectFile: (index: number) => void;
  onSuccessToast: (message: string) => void;
  onErrorToast: (message: string) => void;
}

export const OrganizePagesPanel: React.FC<OrganizePagesPanelProps> = ({
  files,
  selectedIndex,
  onSelectFile,
  onSuccessToast,
  onErrorToast,
}) => {
  const selectedFile = files[selectedIndex];

  // State
  const [pages, setPages] = useState<PageItemState[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [lastSelectedIndex, setLastSelectedIndex] = useState<number | null>(null);
  const [isLoadingPages, setIsLoadingPages] = useState<boolean>(false);
  const [isExporting, setIsExporting] = useState<boolean>(false);
  const [exportResult, setExportResult] = useState<OrganizePagesResult | null>(null);

  // Drag-and-drop state
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);

  // Deletion confirm dialog state
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState<boolean>(false);
  const [pagesToDelete, setPagesToDelete] = useState<number[]>([]); // indexes to delete

  // Load pages when selected file changes
  const loadPageDetails = useCallback(async () => {
    if (!selectedFile) {
      setPages([]);
      setSelectedIds(new Set());
      return;
    }

    setIsLoadingPages(true);
    setExportResult(null);

    try {
      const details = await invoke<PageDetails[]>("get_pdf_pages_details", {
        inputPath: selectedFile.path,
      });

      const initialPages: PageItemState[] = details.map((d, idx) => ({
        id: `page-${selectedFile.name}-${d.page_number}-${idx}-${Date.now()}`,
        originalPageNumber: d.page_number,
        additionalRotation: 0,
        nativeRotation: d.rotation,
        width: d.width,
        height: d.height,
      }));

      setPages(initialPages);
      setSelectedIds(new Set());
      setLastSelectedIndex(null);
    } catch (err) {
      onErrorToast(typeof err === "string" ? err : "Failed to load document pages");
      // Fallback: create stub pages from page_count
      const fallbackPages: PageItemState[] = Array.from(
        { length: selectedFile.page_count },
        (_, i) => ({
          id: `page-fallback-${i + 1}`,
          originalPageNumber: i + 1,
          additionalRotation: 0,
          nativeRotation: 0,
          width: 612,
          height: 792,
        })
      );
      setPages(fallbackPages);
    } finally {
      setIsLoadingPages(false);
    }
  }, [selectedFile, onErrorToast]);

  useEffect(() => {
    loadPageDetails();
  }, [loadPageDetails]);

  // Rotate single page
  const handleRotatePage = (index: number) => {
    setPages((prev) =>
      prev.map((p, idx) =>
        idx === index
          ? {
              ...p,
              additionalRotation: (p.additionalRotation + 90) % 360,
            }
          : p
      )
    );
  };

  // Rotate selected pages (+90°)
  const handleRotateSelected = (delta: number = 90) => {
    if (selectedIds.size === 0) return;
    setPages((prev) =>
      prev.map((p) =>
        selectedIds.has(p.id)
          ? {
              ...p,
              additionalRotation: ((p.additionalRotation + delta) % 360 + 360) % 360,
            }
          : p
      )
    );
  };

  // Rotate all pages (+90°)
  const handleRotateAll = (delta: number = 90) => {
    setPages((prev) =>
      prev.map((p) => ({
        ...p,
        additionalRotation: ((p.additionalRotation + delta) % 360 + 360) % 360,
      }))
    );
  };

  // Toggle selection
  const handleToggleSelect = (index: number, e: React.MouseEvent) => {
    const clickedId = pages[index].id;
    const newSelected = new Set(selectedIds);

    if (e.shiftKey && lastSelectedIndex !== null && lastSelectedIndex !== index) {
      // Range selection
      const start = Math.min(lastSelectedIndex, index);
      const end = Math.max(lastSelectedIndex, index);
      for (let i = start; i <= end; i++) {
        newSelected.add(pages[i].id);
      }
    } else {
      if (newSelected.has(clickedId)) {
        newSelected.delete(clickedId);
      } else {
        newSelected.add(clickedId);
      }
      setLastSelectedIndex(index);
    }

    setSelectedIds(newSelected);
  };

  const handleSelectAll = () => {
    const all = new Set(pages.map((p) => p.id));
    setSelectedIds(all);
  };

  const handleDeselectAll = () => {
    setSelectedIds(new Set());
    setLastSelectedIndex(null);
  };

  // Delete initiated from single page button
  const handleRequestDeletePage = (index: number) => {
    if (pages.length <= 1) {
      onErrorToast("Cannot delete all pages. The document must contain at least one page.");
      return;
    }
    setPagesToDelete([index]);
    setIsDeleteModalOpen(true);
  };

  // Delete initiated from toolbar for selected pages
  const handleRequestDeleteSelected = () => {
    if (selectedIds.size === 0) return;

    if (selectedIds.size >= pages.length) {
      onErrorToast("Cannot delete all pages. The document must contain at least one page.");
      return;
    }

    const indexes = pages
      .map((p, idx) => (selectedIds.has(p.id) ? idx : -1))
      .filter((idx) => idx !== -1);

    setPagesToDelete(indexes);
    setIsDeleteModalOpen(true);
  };

  // Confirm deletion
  const handleConfirmDelete = () => {
    const toDeleteSet = new Set(pagesToDelete);
    const updatedPages = pages.filter((_, idx) => !toDeleteSet.has(idx));
    setPages(updatedPages);

    // Clean up selectedIds
    const remainingIds = new Set(updatedPages.map((p) => p.id));
    const newSelected = new Set(
      Array.from(selectedIds).filter((id) => remainingIds.has(id))
    );
    setSelectedIds(newSelected);

    setIsDeleteModalOpen(false);
    setPagesToDelete([]);
    onSuccessToast(`Removed ${pagesToDelete.length} ${pagesToDelete.length === 1 ? "page" : "pages"}`);
  };

  // Drag and Drop handlers
  const handleDragStart = (e: React.DragEvent, index: number) => {
    setDraggedIndex(index);
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", String(index));
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    if (dragOverIndex !== index) {
      setDragOverIndex(index);
    }
  };

  const handleDrop = (e: React.DragEvent, targetIndex: number) => {
    e.preventDefault();
    if (draggedIndex === null || draggedIndex === targetIndex) {
      setDraggedIndex(null);
      setDragOverIndex(null);
      return;
    }

    setPages((prev) => {
      const copy = [...prev];
      const [movedItem] = copy.splice(draggedIndex, 1);
      copy.splice(targetIndex, 0, movedItem);
      return copy;
    });

    setDraggedIndex(null);
    setDragOverIndex(null);
  };

  const handleDragEnd = () => {
    setDraggedIndex(null);
    setDragOverIndex(null);
  };

  // Reset to original
  const handleReset = () => {
    loadPageDetails();
    onSuccessToast("Reset all page order and rotations to original state");
  };

  // Export modified PDF
  const handleExport = async () => {
    if (!selectedFile || pages.length === 0) return;

    // Pick save destination
    const defaultName = selectedFile.name.replace(/\.pdf$/i, "_organized.pdf");
    let outputPath: string | null = null;
    try {
      outputPath = await invoke<string | null>("save_pdf_dialog", {
        defaultName,
      });
    } catch (err) {
      onErrorToast("Save dialog error: " + err);
      return;
    }

    if (!outputPath) {
      // User cancelled save dialog
      return;
    }

    // Overwrite guard
    if (outputPath.toLowerCase().trim() === selectedFile.path.toLowerCase().trim()) {
      onErrorToast("Cannot overwrite original PDF file. Please choose a different file name.");
      return;
    }

    setIsExporting(true);
    try {
      const actions: PageOrganizeAction[] = pages.map((p) => ({
        original_page_number: p.originalPageNumber,
        rotation: p.additionalRotation,
      }));

      const res = await invoke<OrganizePagesResult>("organize_pdf_pages", {
        inputPath: selectedFile.path,
        outputPath,
        pages: actions,
      });

      setExportResult(res);
      onSuccessToast(`Successfully saved ${res.pages_processed} pages to: ${outputPath}`);
    } catch (err) {
      onErrorToast(typeof err === "string" ? err : "Failed to organize and export PDF");
    } finally {
      setIsExporting(false);
    }
  };

  // Stats calculation
  const modifiedRotationsCount = useMemo(
    () => pages.filter((p) => p.additionalRotation !== 0).length,
    [pages]
  );
  const isReordered = useMemo(
    () => pages.some((p, idx) => p.originalPageNumber !== idx + 1),
    [pages]
  );
  const isModified =
    modifiedRotationsCount > 0 ||
    isReordered ||
    (selectedFile && pages.length !== selectedFile.page_count);

  // Label for confirmation dialog
  const deleteLabels = useMemo(() => {
    return pagesToDelete
      .map((idx) => `#${idx + 1}`)
      .slice(0, 10)
      .join(", ") + (pagesToDelete.length > 10 ? ", ..." : "");
  }, [pagesToDelete]);

  return (
    <div className="action-card organize-pages-card">
      {/* Header */}
      <div className="card-header">
        <div className="header-title-row">
          <div className="title-with-badge">
            <h2 className="card-title">Rotate, Reorder & Delete Pages</h2>
            <span className="badge-pill">Page Organizer</span>
          </div>
        </div>
        <p className="card-description">
          Click a page to rotate 90° clockwise. Drag thumbnails to reorder pages. Select thumbnails to delete.
        </p>
      </div>

      <div className="organize-workspace-body">
        {/* Document Selection Banner */}
        <div className="organize-meta-bar">
          <div className="document-select-box">
            <label htmlFor="organize-doc-select" className="meta-label">
              Document:
            </label>
            <select
              id="organize-doc-select"
              value={selectedIndex}
              onChange={(e) => onSelectFile(Number(e.target.value))}
              className="select-input doc-picker"
            >
              {files.length === 0 ? (
                <option value={0}>No document selected</option>
              ) : (
                files.map((file, idx) => (
                  <option key={`org-file-${file.path}-${idx}`} value={idx}>
                    {file.name} ({file.page_count} pages)
                  </option>
                ))
              )}
            </select>
          </div>

          <div className="organize-stats-badges">
            <span className="stat-pill">
              Pages: <strong>{pages.length}</strong>
            </span>
            {selectedIds.size > 0 && (
              <span className="stat-pill highlight">
                Selected: <strong>{selectedIds.size}</strong>
              </span>
            )}
            {isModified && (
              <span className="stat-pill warning">
                {modifiedRotationsCount > 0 && `${modifiedRotationsCount} rotated `}
                {isReordered && `• reordered `}
                {selectedFile && pages.length < selectedFile.page_count && `• ${selectedFile.page_count - pages.length} deleted`}
              </span>
            )}
          </div>
        </div>

        {/* Sticky Action Toolbar */}
        <div className="organize-action-toolbar">
          <div className="toolbar-group selection-group">
            <button
              type="button"
              className="toolbar-button secondary-button"
              onClick={handleSelectAll}
              disabled={pages.length === 0}
              title="Select all pages"
            >
              Select All
            </button>
            <button
              type="button"
              className="toolbar-button secondary-button"
              onClick={handleDeselectAll}
              disabled={selectedIds.size === 0}
              title="Deselect all pages"
            >
              Deselect
            </button>
          </div>

          <div className="toolbar-divider" />

          <div className="toolbar-group rotate-group">
            <button
              type="button"
              className="toolbar-button secondary-button"
              onClick={() => handleRotateSelected(90)}
              disabled={selectedIds.size === 0}
              title="Rotate selected pages 90° clockwise"
            >
              <span className="tb-icon">⟳</span>
              <span>Rotate Selected (+90°)</span>
            </button>
            <button
              type="button"
              className="toolbar-button secondary-button"
              onClick={() => handleRotateAll(90)}
              disabled={pages.length === 0}
              title="Rotate all pages 90° clockwise"
            >
              <span className="tb-icon">↻</span>
              <span>Rotate All (+90°)</span>
            </button>
          </div>

          <div className="toolbar-divider" />

          <div className="toolbar-group delete-group">
            <button
              type="button"
              className="toolbar-button danger-button"
              onClick={handleRequestDeleteSelected}
              disabled={selectedIds.size === 0 || selectedIds.size >= pages.length}
              title="Delete selected pages (with confirmation)"
            >
              <span className="tb-icon">✕</span>
              <span>Delete Pages ({selectedIds.size})</span>
            </button>
          </div>

          <div className="toolbar-spacer" />

          <div className="toolbar-group cta-group">
            <button
              type="button"
              className="toolbar-button ghost-button"
              onClick={handleReset}
              disabled={!isModified || isExporting}
              title="Reset all changes back to original"
            >
              Reset
            </button>

            <button
              type="button"
              className="action-button primary-button export-btn"
              onClick={handleExport}
              disabled={isExporting || pages.length === 0}
            >
              {isExporting ? (
                <>
                  <span className="spinner-small" />
                  <span>Exporting PDF...</span>
                </>
              ) : (
                <>
                  <span className="btn-icon">💾</span>
                  <span>Export Modified PDF...</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Thumbnail Grid */}
        <div className="organize-grid-container">
          {isLoadingPages ? (
            <div className="grid-loading-state">
              <div className="loading-spinner" />
              <p>Analyzing document page structures...</p>
            </div>
          ) : pages.length === 0 ? (
            <div className="grid-empty-state">
              <p>
                {!selectedFile
                  ? "No document selected. Please add or select a PDF from the left panel."
                  : "No pages found in this document."}
              </p>
            </div>
          ) : (
            <div className="page-thumbnails-grid">
              {pages.map((page, idx) => (
                <LazyPageThumbnail
                  key={page.id}
                  page={page}
                  index={idx}
                  isSelected={selectedIds.has(page.id)}
                  onToggleSelect={handleToggleSelect}
                  onRotatePage={handleRotatePage}
                  onDeletePage={handleRequestDeletePage}
                  onDragStart={handleDragStart}
                  onDragOver={handleDragOver}
                  onDrop={handleDrop}
                  onDragEnd={handleDragEnd}
                  isDragging={draggedIndex === idx}
                  isDragOver={dragOverIndex === idx && draggedIndex !== idx}
                />
              ))}
            </div>
          )}
        </div>

        {/* Export Success Result Banner */}
        {exportResult && (
          <div className="result-panel organize-result-panel">
            <div className="result-header">
              <span className="result-icon-badge">✓</span>
              <div>
                <h4 className="result-title">PDF Successfully Organized & Saved</h4>
                <p className="result-subtitle">
                  {exportResult.pages_processed} pages written to destination. Original file untouched.
                </p>
              </div>
            </div>
            <div className="result-filepath-box">
              <code>{exportResult.output_path}</code>
            </div>
          </div>
        )}
      </div>

      {/* Delete Confirmation Modal */}
      <DeletePagesConfirmDialog
        isOpen={isDeleteModalOpen}
        pagesCount={pagesToDelete.length}
        pageLabels={deleteLabels}
        onConfirm={handleConfirmDelete}
        onClose={() => setIsDeleteModalOpen(false)}
      />
    </div>
  );
};
