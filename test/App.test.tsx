import { fireEvent, render, screen } from "@testing-library/react";
import { App } from "../src/taskpane/App";
import { TreeProvider } from "../src/taskpane/context/TreeContext";

function renderApp() {
  return render(
    <TreeProvider>
      <App />
    </TreeProvider>
  );
}

describe("taskpane critical flow", () => {
  it("loads an example and reports the expected-cost comparison", () => {
    renderApp();

    fireEvent.click(screen.getByRole("button", { name: /Workover de pozo/i }));
    fireEvent.click(screen.getByRole("tab", { name: "Resultado" }));

    expect(screen.getByText("Elegir: Hacer workover")).toBeInTheDocument();
    expect(screen.getByText("Ahorra vs No intervenir:")).toBeInTheDocument();
    expect(screen.getAllByText("$4.500").length).toBeGreaterThan(0);
    expect(screen.getByText(/Margen estrecho/)).toBeInTheDocument();
    expect(screen.getByText("Decisiones posteriores")).toBeInTheDocument();
    expect(screen.getByText("Abandonar pozo")).toBeInTheDocument();

    const operationalResult = screen.getByRole("textbox", { name: "Probabilidad de Resultado operativo" });
    fireEvent.change(operationalResult, { target: { value: "70" } });
    fireEvent.blur(operationalResult);

    expect(screen.getByText("Elegir: Hacer workover")).toBeInTheDocument();
    expect(screen.getAllByText("$11.000").length).toBeGreaterThan(0);
  });

  it("supports arrow-key navigation between tabs", () => {
    renderApp();

    const buildTab = screen.getByRole("tab", { name: "Armar" });
    fireEvent.keyDown(buildTab, { key: "ArrowRight" });

    expect(screen.getByRole("tab", { name: "Resultado" })).toHaveAttribute("aria-selected", "true");
  });
});
