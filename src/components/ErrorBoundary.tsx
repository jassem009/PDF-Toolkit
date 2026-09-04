import { Component, ErrorInfo, ReactNode } from "react";

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    // Graceful error logging placeholder for production error reporting
    void error;
    void errorInfo;
  }

  private handleReload = () => {
    window.location.reload();
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div className="app-container" style={{ justifyContent: "center", alignItems: "center", padding: "2rem" }}>
          <div
            className="action-card"
            style={{ maxWidth: "480px", textAlign: "center", padding: "2.5rem 2rem", margin: "auto" }}
          >
            <div style={{ fontSize: "40px", marginBottom: "1rem" }}>⚠️</div>
            <h2 style={{ fontSize: "18px", fontWeight: 700, marginBottom: "0.75rem", color: "var(--text-main)" }}>
              Something went wrong
            </h2>
            <p style={{ fontSize: "13px", color: "var(--text-muted)", marginBottom: "1.5rem", lineHeight: 1.5 }}>
              {this.state.error?.message || "An unexpected error occurred while processing your request."}
            </p>
            <button
              type="button"
              className="action-button primary-button"
              onClick={this.handleReload}
              style={{ margin: "0 auto" }}
            >
              Reload Application
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
