import React from "react";
import ReactDOM from "react-dom/client";
import { useSystemStats } from "./hooks/useSystemStats";
import DynamicIsland from "./components/DynamicIsland";
import "./island.css";

function IslandApp() {
  // Receive the same telemetry broadcast the main window listens to.
  // DynamicIsland itself sizes & positions the window (auto-hide / reveal).
  useSystemStats();
  return <DynamicIsland />;
}

ReactDOM.createRoot(document.getElementById("island-root") as HTMLElement).render(
  <React.StrictMode>
    <IslandApp />
  </React.StrictMode>,
);
