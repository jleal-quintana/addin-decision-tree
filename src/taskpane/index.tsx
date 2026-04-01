import React from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App";
import { TreeProvider } from "./context/TreeContext";
import "./styles/App.css";

const rootEl = document.getElementById("root")!;
const root = createRoot(rootEl);

Office.onReady((info) => {
  if (info.host === Office.HostType.Excel) {
    if (!Office.context.requirements.isSetSupported("ExcelApi", "1.10")) {
      root.render(
        <div style={{ padding: 24, textAlign: "center", fontFamily: "Montserrat, sans-serif" }}>
          <h2 style={{ color: "#33492D" }}>Version no compatible</h2>
          <p>Este add-in requiere Excel con ExcelApi 1.10 o superior (Microsoft 365).</p>
        </div>
      );
      return;
    }
  }

  root.render(
    <TreeProvider>
      <App />
    </TreeProvider>
  );
});
