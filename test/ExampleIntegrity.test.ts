import {
  oilDrillingExample,
  productLaunchExample,
  vacaMuertaDevelopmentExample,
  workoverExample,
} from "../src/engine/Examples";
import { compareRootDecision } from "../src/engine/DecisionComparison";
import { calculateExpectedValues } from "../src/engine/ExpectedValueCalculator";
import { validate } from "../src/models/DecisionTree";
import {
  capacityDecisionExample,
  threeProposalsExample,
} from "../src/taskpane/data/PdfExamples";

const examples = [
  ["workover", workoverExample],
  ["perforacion", oilDrillingExample],
  ["producto", productLaunchExample],
  ["Vaca Muerta", vacaMuertaDevelopmentExample],
  ["capacidad", capacityDecisionExample],
  ["propuestas", threeProposalsExample],
] as const;

describe("example integrity", () => {
  it.each(examples)("keeps the %s example valid and decision-ready", (_name, create) => {
    const tree = create();
    const values = calculateExpectedValues(tree);
    const comparison = compareRootDecision(tree);

    expect(validate(tree)).toEqual([]);
    expect(tree.rootId).not.toBeNull();
    expect(values[tree.rootId!]).toEqual(expect.any(Number));
    expect(Number.isFinite(values[tree.rootId!]!)).toBe(true);
    expect(comparison).not.toBeNull();
  });
});
