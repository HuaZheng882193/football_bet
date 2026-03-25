import { useState } from "react";
import App from "./App";
import ScoreBetPage from "./ScoreBetPage";

const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL || "http://127.0.0.1:8000";

export default function RootApp() {
  const [view, setView] = useState("odds");

  if (view === "odds") {
    return (
      <>
        <button
          type="button"
          className="page-switcher"
          onClick={() => setView("score")}>
          比分投注
        </button>
        <App />
      </>
    );
  }

  return (
    <div className="app-shell">
      <div className="page-glow page-glow--left" />
      <div className="page-glow page-glow--right" />

      <header className="topbar">
        <div className="brand-wrap">
          <div className="brand">Score Bets</div>
          <p className="brand-subtitle">比分投注</p>
        </div>

        <div className="topbar__actions">
          <button
            type="button"
            className="export-button"
            onClick={() => setView("odds")}>
            返回原投注系统
          </button>
        </div>
      </header>

      <ScoreBetPage apiBaseUrl={API_BASE_URL} />
    </div>
  );
}
