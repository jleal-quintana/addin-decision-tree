import { fireEvent, render, screen, within } from "@testing-library/react";
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

    fireEvent.change(screen.getByLabelText("Costo de Hacer workover"), {
      target: { value: "10" },
    });
    fireEvent.change(screen.getByLabelText("Valor final de Hacer workover"), {
      target: { value: "100" },
    });
    fireEvent.change(screen.getByLabelText("Valor final de No intervenir"), {
      target: { value: "40" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Listo con esta etapa" }));
    fireEvent.click(screen.getByRole("button", { name: "Revisar árbol" }));

    expect(screen.getByText("Recomendación preliminar")).toBeInTheDocument();
    expect(screen.getAllByText("Hacer workover").length).toBeGreaterThan(0);
    fireEvent.click(screen.getByRole("button", { name: "Crear árbol y revisarlo" }));

    expect(screen.getByRole("tab", { name: "Armar" })).toBeInTheDocument();
    expect(screen.getByText("¿Conviene hacer el workover?")).toBeInTheDocument();
    expect(screen.getAllByText("Valor esp.: $90").length).toBeGreaterThan(0);
  });

  it("builds recursive decision and uncertainty stages in the guided flow", () => {
    renderApp();
    fireEvent.click(screen.getByRole("button", { name: "Empezar paso a paso" }));
    fireEvent.change(screen.getByLabelText("Pregunta principal"), {
      target: { value: "¿Perforar el prospecto?" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Continuar" }));

    fireEvent.change(screen.getByLabelText("Alternativa 1"), { target: { value: "Perforar" } });
    fireEvent.change(screen.getByLabelText("Alternativa 2"), { target: { value: "Vender área" } });
    fireEvent.click(screen.getByRole("button", { name: "Continuar" }));

    fireEvent.change(screen.getByLabelText("Costo de Perforar"), { target: { value: "100" } });
    fireEvent.click(
      within(screen.getByRole("radiogroup", { name: "Destino de Perforar" }))
        .getByRole("radio", { name: /Evento incierto/ })
    );
    fireEvent.change(screen.getByLabelText("Valor final de Vender área"), { target: { value: "50" } });
    fireEvent.click(screen.getByRole("button", { name: "Definir etapa" }));

    fireEvent.change(screen.getByLabelText("Nombre de la incertidumbre"), {
      target: { value: "Resultado geológico" },
    });
    fireEvent.change(screen.getByLabelText("Evento 1"), { target: { value: "Éxito" } });
    fireEvent.change(screen.getByLabelText("Evento 2"), { target: { value: "Falla" } });
    fireEvent.change(screen.getByLabelText("Probabilidad de Éxito"), {
      target: { value: "70" },
    });
    fireEvent.click(
      within(screen.getByRole("radiogroup", { name: "Destino de Éxito" }))
        .getByRole("radio", { name: "Decisión" })
    );
    fireEvent.change(screen.getByLabelText("Valor final de Falla"), { target: { value: "-100" } });
    fireEvent.click(screen.getByRole("button", { name: "Definir etapa" }));

    fireEvent.change(screen.getByLabelText("Pregunta de esta decisión"), {
      target: { value: "¿Cómo completar el pozo?" },
    });
    fireEvent.change(screen.getByLabelText("Alternativa 1"), { target: { value: "Completar" } });
    fireEvent.change(screen.getByLabelText("Alternativa 2"), { target: { value: "Sidetrack" } });
    fireEvent.click(
      within(screen.getByRole("radiogroup", { name: "Destino de Completar" }))
        .getByRole("radio", { name: /Evento incierto/ })
    );
    fireEvent.change(screen.getByLabelText("Valor final de Sidetrack"), { target: { value: "200" } });
    fireEvent.click(screen.getByRole("button", { name: "Definir etapa" }));

    fireEvent.change(screen.getByLabelText("Nombre de la incertidumbre"), {
      target: { value: "Resultado de terminación" },
    });
    fireEvent.change(screen.getByLabelText("Probabilidad de Evento favorable"), {
      target: { value: "70" },
    });
    fireEvent.change(screen.getByLabelText("Valor final de Evento favorable"), { target: { value: "500" } });
    fireEvent.change(screen.getByLabelText("Valor final de Evento adverso"), { target: { value: "-50" } });
    fireEvent.click(screen.getByRole("button", { name: "Listo con esta etapa" }));

    expect(screen.getByLabelText("Resumen de estructura")).toHaveTextContent("4 niveles");
    fireEvent.click(screen.getByRole("button", { name: "Revisar árbol" }));
    expect(screen.getByText(/4 niveles/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Crear árbol y revisarlo" }));

    expect(screen.getByText("¿Cómo completar el pozo?")).toBeInTheDocument();
    expect(screen.getByText("Resultado de terminación")).toBeInTheDocument();
  });
});
