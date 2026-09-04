import React from "react";

interface DeletePagesConfirmDialogProps {
  isOpen: boolean;
  pagesCount: number;
  pageLabels: string;
  onConfirm: () => void;
  onClose: () => void;
}

export const DeletePagesConfirmDialog: React.FC<DeletePagesConfirmDialogProps> = ({
  isOpen,
  pagesCount,
  pageLabels,
  onConfirm,
  onClose,
}) => {
  if (!isOpen || pagesCount === 0) return null;

  const promptTitle = pagesCount === 1 ? "Remove 1 page?" : `Remove ${pagesCount} pages?`;

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className="modal-dialog delete-confirm-dialog"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-labelledby="delete-dialog-title"
      >
        <div className="modal-header">
          <div className="modal-title-box">
            <h3 id="delete-dialog-title" className="modal-title delete-title">
              {promptTitle}
            </h3>
            <p className="modal-subtitle">
              {pageLabels
                ? `Pages ${pageLabels} will be removed from the sequence.`
                : "The selected pages will be removed from the document."}
            </p>
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

        <div className="modal-body delete-dialog-body">
          <p className="delete-note">
            The original PDF file will remain unchanged. You can also reset changes at any time before exporting.
          </p>
        </div>

        <div className="modal-footer dialog-actions-row">
          <button
            type="button"
            className="action-button secondary-button"
            onClick={onClose}
          >
            Cancel
          </button>
          <button
            type="button"
            className="action-button danger-button"
            onClick={onConfirm}
          >
            {promptTitle.replace("?", "")}
          </button>
        </div>
      </div>
    </div>
  );
};
