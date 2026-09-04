import { useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import "./App.css";

export function App() {
  const [greetMsg, setGreetMsg] = useState("");
  const [name, setName] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  async function handleGreet(e: React.FormEvent) {
    e.preventDefault();
    try {
      setIsLoading(true);
      const res = await invoke<string>("greet", { name: name || "Developer" });
      setGreetMsg(res);
    } catch (err) {
      setGreetMsg(`Error invoking command: ${String(err)}`);
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="app-window">
      <header className="window-header">
        <div className="brand-badge">
          <div className="brand-icon">PDF</div>
          <span className="app-title">PDF Toolkit</span>
        </div>
        <span className="version-pill">v0.1.0</span>
      </header>

      <main className="window-body">
        <div>
          <h1 className="hero-heading">PDF Toolkit</h1>
          <p className="hero-subtitle">
            Commercial-grade desktop suite for private, lightning-fast PDF manipulation.
          </p>
        </div>

        <section className="ipc-box">
          <span className="ipc-label">
            <span className="status-dot"></span>
            Rust IPC Bridge Test
          </span>

          <form className="ipc-form" onSubmit={handleGreet}>
            <input
              id="greet-input"
              className="ipc-input"
              type="text"
              value={name}
              onChange={(e) => setName(e.currentTarget.value)}
              placeholder="Enter name to test Rust command..."
            />
            <button className="ipc-button" type="submit" disabled={isLoading}>
              {isLoading ? "Invoking..." : "Invoke Greet"}
            </button>
          </form>

          {greetMsg && (
            <div className="ipc-response">
              {greetMsg}
            </div>
          )}
        </section>
      </main>

      <footer className="window-footer">
        <span>Tauri 2 • React 19 • TypeScript • Rust Backend</span>
        <span>Ready</span>
      </footer>
    </div>
  );
}

export default App;
