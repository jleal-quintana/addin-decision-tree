import React from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App";
import { TreeProvider } from "./context/TreeContext";
import "./styles/App.css";

const rootEl = document.getElementById("root")!;
const root = createRoot(rootEl);

function renderBootstrapError(title: string, message: string) {
  root.render(
    <div style={{ padding: 24, textAlign: "center", fontFamily: "Montserrat, sans-serif" }}>
      <h2 style={{ color: "#33492D" }}>{title}</h2>
      <p>{message}</p>
    </div>
  );
}

if (typeof Office === "undefined") {
  renderBootstrapError(
    "Office no disponible",
    "El runtime de Office no esta cargado. Abre este front-end desde Excel Desktop."
  );
} else {
  let bootstrapped = false;
  const fallbackTimer = window.setTimeout(() => {
    if (!bootstrapped) {
      renderBootstrapError(
        "Inicializacion lenta",
        "Office no respondio a tiempo. Reabre el panel o revisa el modo debug."
      );
    }
  }, 6000);

  Office.onReady((info) => {
    bootstrapped = true;
    window.clearTimeout(fallbackTimer);

    if (
      info.host === Office.HostType.Excel &&
      !Office.context.requirements.isSetSupported("ExcelApi", "1.10")
    ) {
      renderBootstrapError(
        "Version no compatible",
        "Este add-in requiere Excel con ExcelApi 1.10 o superior."
      );
      return;
    }

    root.render(
      <TreeProvider>
        <App />
      </TreeProvider>
    );
  });
}
