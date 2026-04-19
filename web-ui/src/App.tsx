import { useState } from "react";
import { useBootstrap, useSimulator, totalRate } from "./data/simulator";
import SystemFlow from "./pages/SystemFlow";
import DataScreen from "./pages/DataScreen";

type TabId = "flow" | "screen";

const TABS: { id: TabId; label: string; num: string }[] = [
  { id: "flow", label: "System Flow", num: "01" },
  { id: "screen", label: "Data Screen", num: "02" },
];

export default function App() {
  useBootstrap();
  const [tab, setTab] = useState<TabId>("flow");
  const state = useSimulator();
  const rate = totalRate(state);

  return (
    <div className="app">
      <header className="topbar">
        <div className="wordmark">
          <div className="wordmark__glyph">◉</div>
          <div className="wordmark__text">
            <strong>IoT Signal Atlas</strong>
            <span>Producer · Kafka · Consumer · Redis · Mongo</span>
          </div>
        </div>

        <nav className="tabs" aria-label="Primary">
          {TABS.map((t) => (
            <button
              key={t.id}
              className={`tab ${tab === t.id ? "active" : ""}`}
              onClick={() => setTab(t.id)}
            >
              <span className="tab__num">{t.num}</span>
              {t.label}
            </button>
          ))}
        </nav>

        <div className="topbar__meta">
          <span>
            {rate.toFixed(1)} <span style={{ opacity: 0.6 }}>msg/s</span>
          </span>
          <span className="sep" />
          <span className={`pill ${state.running ? "ok" : "warn"}`}>
            <span className="dot" />
            {state.running ? "live" : "paused"}
          </span>
        </div>
      </header>

      <main className="main">
        {tab === "flow" && (
          <div className="page" key="flow">
            <SystemFlow />
          </div>
        )}
        {tab === "screen" && (
          <div className="page" key="screen">
            <DataScreen />
          </div>
        )}
      </main>
    </div>
  );
}
