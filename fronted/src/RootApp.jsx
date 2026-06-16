import { useState } from "react";
import App from "./App";
import ScoreBetPage from "./ScoreBetPage";
import OutrightBetPage from "./OutrightBetPage";

const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL || "http://127.0.0.1:8000";

export default function RootApp() {
  const [view, setView] = useState("odds");

  if (view === "odds") {
    return (
      <>
        <div style={{ position: 'fixed', top: '16px', right: '16px', zIndex: 100, display: 'flex', gap: '8px' }}>
          <button
            type="button"
            className="page-switcher"
            style={{ position: 'static', margin: 0 }}
            onClick={() => setView("score")}>
            比分投注
          </button>
          <button
            type="button"
            className="page-switcher"
            style={{ position: 'static', margin: 0 }}
            onClick={() => setView("outright")}>
            冠军投注
          </button>
        </div>
        <App />
      </>
    );
  }

  if (view === "score") {
    return (
      <div className="app-shell">
        <div className="page-glow page-glow--left" />
        <div className="page-glow page-glow--right" />

        <header className="topbar">
          <div className="brand-wrap">
            <div className="brand">Score Bets</div>
            <p className="brand-subtitle">比分投注</p>
          </div>

          <div className="topbar__actions" style={{ display: 'flex', gap: '8px' }}>
            <button
              type="button"
              className="export-button"
              onClick={() => setView("odds")}>
              标准盘
            </button>
            <button
              type="button"
              className="export-button"
              onClick={() => setView("outright")}>
              冠军投注
            </button>
          </div>
        </header>

        <ScoreBetPage apiBaseUrl={API_BASE_URL} />
      </div>
    );
  }

  // outright view
  return (
    <div className="app-shell">
      <div className="page-glow page-glow--left" />
      <div className="page-glow page-glow--right" />

      <header className="topbar">
        <div className="brand-wrap">
          <div className="brand">Outright Bets</div>
          <p className="brand-subtitle">冠军投注</p>
        </div>

        <div className="topbar__actions" style={{ display: 'flex', gap: '8px' }}>
          <button
            type="button"
            className="export-button"
            onClick={() => setView("odds")}>
            标准盘
          </button>
          <button
            type="button"
            className="export-button"
            onClick={() => setView("score")}>
            比分投注
          </button>
        </div>
      </header>

      <OutrightBetPage apiBaseUrl={API_BASE_URL} />
    </div>
  );
}
