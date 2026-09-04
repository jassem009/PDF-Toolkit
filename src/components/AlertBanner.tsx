import React from "react";

export type AlertType = "success" | "error" | "info" | "warning";

export interface AlertBannerProps {
  type: AlertType;
  message?: string | null;
  children?: React.ReactNode;
  onDismiss?: () => void;
  className?: string;
  title?: string;
}

const ICONS: Record<AlertType, string> = {
  success: "✓",
  error: "⚠️",
  info: "ℹ️",
  warning: "⚠️",
};

export const AlertBanner: React.FC<AlertBannerProps> = ({
  type,
  message,
  children,
  onDismiss,
  className = "",
  title,
}) => {
  if (!message && !children) return null;

  return (
    <div className={`alert-banner ${type} ${className}`}>
      <span className="alert-icon">{ICONS[type]}</span>
      {children ? (
        children
      ) : (
        <div className={onDismiss ? "alert-error-content" : undefined}>
          {title && <strong>{title}</strong>}
          <span>{message}</span>
        </div>
      )}
      {onDismiss && (
        <button
          type="button"
          className="alert-dismiss-btn"
          onClick={onDismiss}
          title="Dismiss"
        >
          ✕
        </button>
      )}
    </div>
  );
};
