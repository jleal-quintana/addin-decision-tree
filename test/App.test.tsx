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

    fireEvent.click(screen.getByText("Ver ejemplos resueltos"));
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

    fireEvent.click(screen.getByText("Ver ejemplos resueltos"));
    fireEvent.click(screen.getByRole("button", { name: /Workover de pozo/i }));

    const buildTab = screen.getByRole("tab", { name: "Armar" });
    fireEvent.keyDown(buildTab, { key: "ArrowRight" });

    expect(screen.getByRole("tab", { name: "Resultado" })).toHaveAttribute("aria-selected", "true");
  });

  it("creates a useful tree through the guided first-run flow", () => {
    renderApp();

    expect(screen.queryByRole("tab", { name: "Armar" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Empezar paso a paso" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Empezar paso a paso" }));

    fireEvent.change(screen.getByLabelText("Pregunta principal"), {
      target: { value: "¿Conviene hacer el workover?" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Continuar" }));

    fireEvent.change(screen.getByLabelText("Alternativa 1"), {
      target: { value: "Hacer workover" },
    });
    fireEvent.change(screen.getByLabelText("Alternativa 2"), {
      target: { value: "No intervenir" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Continuar" }));

    fireEvent.change(screen.getByLabelText("Valor neto o VAN ($)"), {
      target: { value: "100" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Siguiente alternativa" }));

    fireEvent.change(screen.getByLabelText("Valor neto o VAN ($)"), {
      target: { value: "40" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Continuar" }));

    expect(screen.getByText("Recomendación preliminar")).toBeInTheDocument();
    expect(screen.getAllByText("Hacer workover").length).toBeGreaterThan(0);
    fireEvent.click(screen.getByRole("button", { name: "Crear árbol y revisarlo" }));

    expect(screen.getByRole("tab", { name: "Armar" })).toBeInTheDocument();
    expect(screen.getByText("¿Conviene hacer el workover?")).toBeInTheDocument();
    expect(screen.getAllByText("Valor esp.: $100").length).toBeGreaterThan(0);
  });
});
