import React, { useState, useEffect, useRef } from "react";
import { PageItemState } from "../types/pdf";

interface LazyPageThumbnailProps {
  page: PageItemState;
  index: number;
  isSelected: boolean;
  onToggleSelect: (index: number, e: React.MouseEvent) => void;
  onRotatePage: (index: number, delta?: number) => void;
  onDeletePage: (index: number) => void;
  onDragStart: (e: React.DragEvent, index: number) => void;
  onDragOver: (e: React.DragEvent, index: number) => void;
  onDrop: (e: React.DragEvent, index: number) => void;
  onDragEnd: (e: React.DragEvent) => void;
  isDragging: boolean;
  isDragOver: boolean;
}

export const LazyPageThumbnail: React.FC<LazyPageThumbnailProps> = ({
  page,
  index,
  isSelected,
  onToggleSelect,
  onRotatePage,
  onDeletePage,
  onDragStart,
  onDragOver,
  onDrop,
  onDragEnd,
  isDragging,
  isDragOver,
}) => {
  const [isVisible, setIsVisible] = useState(false);
  const cellRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = cellRef.current;
    if (!el) return;

    // Bug 6A fix: bidirectional observer — unload content when the cell scrolls
    // beyond the 400 px prefetch band so off-screen thumbnails never accumulate
    // in the DOM. With a 400 px margin, content mounts well before the user sees
    // the cell and unmounts only after it has scrolled far enough away to avoid
    // visible flicker on normal scroll speeds.
    const observer = new IntersectionObserver(
      (entries) => {
        const [entry] = entries;
        setIsVisible(entry.isIntersecting);
      },
      {
        rootMargin: "400px 0px",
        threshold: 0.01,
      }
    );

    observer.observe(el);
    return () => {
      observer.disconnect();
    };
  }, []);

  const totalEffectiveRotation = ((page.nativeRotation + page.additionalRotation) % 360 + 360) % 360;
  const isLandscape = (totalEffectiveRotation === 90 || totalEffectiveRotation === 270)
    ? page.height >= page.width
    : page.width > page.height;

  // Handle card click to rotate (per prompt: "click a page to rotate 90° clockwise, click again for 180°, etc.")
  const handleCardClick = (e: React.MouseEvent) => {
    // If clicking checkbox or buttons, avoid rotating
    const target = e.target as HTMLElement;
    if (
      target.closest(".thumbnail-checkbox-label") ||
      target.closest(".thumbnail-btn")
    ) {
      return;
    }
    // Card body click always rotates clockwise (+90°)
    onRotatePage(index, 90);
  };

  return (
    <div
      ref={cellRef}
      className={`page-thumbnail-cell ${isSelected ? "selected" : ""} ${
        isDragging ? "dragging" : ""
      } ${isDragOver ? "drag-over" : ""}`}
      draggable={true}
      onDragStart={(e) => onDragStart(e, index)}
      onDragOver={(e) => onDragOver(e, index)}
      onDrop={(e) => onDrop(e, index)}
      onDragEnd={onDragEnd}
      onClick={handleCardClick}
      title={`Page ${index + 1} (Orig: ${page.originalPageNumber}) — Click to rotate`}
    >
      {!isVisible ? (
        // Lightweight skeleton placeholder for off-screen cells
        <div className="thumbnail-skeleton-placeholder">
          <span className="placeholder-number">#{index + 1}</span>
        </div>
      ) : (
        <div className="thumbnail-card-inner">
          {/* Top Info Bar */}
          <div className="thumbnail-top-bar" onClick={(e) => e.stopPropagation()}>
            <label
              className="thumbnail-checkbox-label"
              onClick={(e) => {
                e.stopPropagation();
                onToggleSelect(index, e);
              }}
            >
              <input
                type="checkbox"
                checked={isSelected}
                onChange={() => {}} // handled by label onClick for multi-select
                className="thumbnail-checkbox"
                aria-label={`Select page ${index + 1}`}
              />
              <span className="checkbox-custom" />
            </label>

            <span className="page-seq-badge">#{index + 1}</span>

            {page.originalPageNumber !== index + 1 && (
              <span className="orig-page-badge" title="Original page number in PDF">
                Orig {page.originalPageNumber}
              </span>
            )}

            {page.additionalRotation !== 0 && (
              <span className="rotation-badge" title="Additional rotation applied">
                +{page.additionalRotation}°
              </span>
            )}
          </div>

          {/* Paper Sheet Preview with Rotation */}
          <div className="thumbnail-paper-viewport">
            <div
              className={`thumbnail-paper-sheet ${isLandscape ? "landscape" : "portrait"}`}
              style={{
                transform: `rotate(${page.additionalRotation}deg)`,
              }}
            >
              <div className="sheet-mini-header">
                <span className="sheet-mini-title">P.{page.originalPageNumber}</span>
              </div>
              <div className="sheet-skeleton-content">
                <div className="sheet-bar w-75" />
                <div className="sheet-bar w-100" />
                <div className="sheet-bar w-90" />
                <div className="sheet-bar w-95" />
                <div className="sheet-bar w-80" />
                <div className="sheet-bar w-85" />
                <div className="sheet-bar w-60" />
              </div>
              <div className="sheet-mini-footer">
                <span>{page.originalPageNumber}</span>
              </div>
            </div>
          </div>

          {/* Hover Action Bar */}
          <div className="thumbnail-bottom-bar" onClick={(e) => e.stopPropagation()}>
            {/* Bug 1A fix: expose both CW and CCW rotation per-thumbnail */}
            <button
              type="button"
              className="thumbnail-btn rotate-btn"
              onClick={() => onRotatePage(index, -90)}
              title="Rotate 90° counter-clockwise"
            >
              <span className="btn-icon">⟲</span>
              <span className="btn-text">-90°</span>
            </button>

            <button
              type="button"
              className="thumbnail-btn rotate-btn"
              onClick={() => onRotatePage(index, 90)}
              title="Rotate 90° clockwise"
            >
              <span className="btn-icon">⟳</span>
              <span className="btn-text">+90°</span>
            </button>

            <button
              type="button"
              className="thumbnail-btn delete-btn"
              onClick={() => onDeletePage(index)}
              title="Remove this page"
            >
              <span className="btn-icon">✕</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
