function columnToIndex(column: string): number {
  let total = 0;
  for (const char of column.toUpperCase()) {
    total = total * 26 + (char.charCodeAt(0) - 64);
  }
  return total - 1;
}

function indexToColumn(index: number): string {
  let value = index + 1;
  let result = "";
  while (value > 0) {
    const remainder = (value - 1) % 26;
    result = String.fromCharCode(65 + remainder) + result;
    value = Math.floor((value - 1) / 26);
  }
  return result;
}

function parseAddress(address: string) {
  const columnRange = /^([A-Z]+):([A-Z]+)$/i.exec(address);
  if (columnRange) {
    return {
      startCol: columnToIndex(columnRange[1]),
      endCol: columnToIndex(columnRange[2]),
      startRow: 0,
      endRow: 0,
      kind: "column",
    } as const;
  }

  const rowRange = /^(\d+):(\d+)$/.exec(address);
  if (rowRange) {
    return {
      startCol: 0,
      endCol: 0,
      startRow: Number(rowRange[1]) - 1,
      endRow: Number(rowRange[2]) - 1,
      kind: "row",
    } as const;
  }

  const multiCell = /^([A-Z]+)(\d+):([A-Z]+)(\d+)$/i.exec(address);
  if (multiCell) {
    return {
      startCol: columnToIndex(multiCell[1]),
      endCol: columnToIndex(multiCell[3]),
      startRow: Number(multiCell[2]) - 1,
      endRow: Number(multiCell[4]) - 1,
      kind: "cell",
    } as const;
  }

  const singleCell = /^([A-Z]+)(\d+)$/i.exec(address);
  if (singleCell) {
    return {
      startCol: columnToIndex(singleCell[1]),
      endCol: columnToIndex(singleCell[1]),
      startRow: Number(singleCell[2]) - 1,
      endRow: Number(singleCell[2]) - 1,
      kind: "cell",
    } as const;
  }

  throw new Error(`Unsupported address: ${address}`);
}

interface CellState {
  value?: unknown;
  formula?: unknown;
  numberFormat?: unknown;
}

class FakeShape {
  name = "";
  left = 0;
  top = 0;
  width = 0;
  height = 0;
  placement = "";
  deleted = false;
  fill = {
    color: "",
    transparency: 0,
    setSolidColor: (value: string) => {
      this.fill.color = value;
    },
  };
  lineFormat = {
    color: "",
    weight: 0,
    visible: true,
  };
  line = {
    endArrowheadStyle: "",
    endArrowheadLength: "",
    endArrowheadWidth: "",
    beginArrowheadStyle: "",
  };
  textFrame = {
    horizontalAlignment: "",
    verticalAlignment: "",
    leftMargin: 0,
    rightMargin: 0,
    topMargin: 0,
    bottomMargin: 0,
    autoSizeSetting: "",
    textRange: {
      text: "",
      font: {
        color: "",
        name: "",
        size: 0,
        bold: false,
      },
    },
  };

  constructor(private readonly owner: FakeShapesCollection, public readonly kind: string) {}

  delete() {
    this.deleted = true;
    this.owner.items = this.owner.items.filter((shape) => shape !== this);
  }
}

class FakeShapesCollection {
  items: FakeShape[] = [];

  load(_value: string) {}

  addGeometricShape(kind: string) {
    const shape = new FakeShape(this, kind);
    this.items.push(shape);
    return shape as unknown as Excel.Shape;
  }

  addTextBox(text: string) {
    const shape = new FakeShape(this, "TextBox");
    shape.textFrame.textRange.text = text;
    this.items.push(shape);
    return shape as unknown as Excel.Shape;
  }

  addLine(x1: number, y1: number, x2: number, y2: number, kind: string) {
    const shape = new FakeShape(this, kind);
    shape.left = x1;
    shape.top = y1;
    shape.width = x2 - x1;
    shape.height = y2 - y1;
    this.items.push(shape);
    return shape as unknown as Excel.Shape;
  }
}

class FakeRangeFormat {
  font = {
    name: "",
    size: 0,
    bold: false,
    color: "",
  };
  fill = {
    color: "",
  };
  private _columnWidth = 15;
  private _rowHeight = 24;
  constructor(private readonly worksheet: FakeWorksheet, private readonly address: string) {}

  set columnWidth(value: number) {
    this._columnWidth = value;
    const parsed = parseAddress(this.address);
    if (parsed.kind === "column" || parsed.kind === "cell") {
      for (let col = parsed.startCol; col <= parsed.endCol; col++) {
        this.worksheet.columnWidths.set(col, value);
      }
    }
  }

  get columnWidth() {
    return this._columnWidth;
  }

  set rowHeight(value: number) {
    this._rowHeight = value;
    const parsed = parseAddress(this.address);
    if (parsed.kind === "row" || parsed.kind === "cell") {
      for (let row = parsed.startRow; row <= parsed.endRow; row++) {
        this.worksheet.rowHeights.set(row, value);
      }
    }
  }

  get rowHeight() {
    return this._rowHeight;
  }

  autofitColumns() {}
}

class FakeRange {
  format: FakeRangeFormat;
  isNullObject = false;
  left = 0;
  top = 0;
  width = 0;
  height = 0;

  constructor(
    private readonly worksheet: FakeWorksheet,
    public readonly address: string,
    private readonly kind: "normal" | "used-range" = "normal"
  ) {
    this.format = new FakeRangeFormat(worksheet, address);
    this.refreshBounds();
  }

  get values() {
    return this.worksheet.readMatrix(this.address, "value");
  }

  set values(value: unknown[][]) {
    this.worksheet.writeMatrix(this.address, "value", value);
  }

  get formulas() {
    return this.worksheet.readMatrix(this.address, "formula");
  }

  set formulas(value: unknown[][]) {
    this.worksheet.writeMatrix(this.address, "formula", value);
  }

  get numberFormat() {
    return this.worksheet.readMatrix(this.address, "numberFormat");
  }

  set numberFormat(value: unknown[][]) {
    this.worksheet.writeMatrix(this.address, "numberFormat", value);
  }

  load(_value: string) {
    this.refreshBounds();
  }

  refreshBounds() {
    const parsed = parseAddress(this.address);
    const columnWidth = this.worksheet.getColumnWidth(parsed.startCol);
    const rowHeight = this.worksheet.getRowHeight(parsed.startRow);
    this.left = parsed.startCol * columnWidth;
    this.top = parsed.startRow * rowHeight;
    this.width = (parsed.endCol - parsed.startCol + 1) * columnWidth;
    this.height = (parsed.endRow - parsed.startRow + 1) * rowHeight;
  }

  clear() {
    if (this.kind === "used-range") {
      this.worksheet.clear();
      return;
    }

    this.worksheet.clearRange(this.address);
  }

  merge() {}

  getEntireColumn() {
    return { columnHidden: false };
  }
}

class FakeNullRange extends FakeRange {
  constructor(worksheet: FakeWorksheet) {
    super(worksheet, "A1");
    this.isNullObject = true;
  }

  override clear() {}
}

class FakeWorksheet {
  visibility = "Visible";
  showGridlines = true;
  activated = false;
  readonly shapes = new FakeShapesCollection();
  readonly ranges = new Map<string, FakeRange>();
  readonly columnWidths = new Map<number, number>();
  readonly rowHeights = new Map<number, number>();
  readonly cells = new Map<string, CellState>();

  constructor(public readonly context: FakeRequestContext, public name: string) {}

  load(_value: string) {}

  activate() {
    this.activated = true;
  }

  getColumnWidth(index: number) {
    return this.columnWidths.get(index) ?? 15;
  }

  getRowHeight(index: number) {
    return this.rowHeights.get(index) ?? 24;
  }

  getRange(address: string) {
    if (!this.ranges.has(address)) {
      this.ranges.set(address, new FakeRange(this, address));
    }
    return this.ranges.get(address)! as unknown as Excel.Range;
  }

  getCell(row: number, col: number) {
    return this.getRange(`${indexToColumn(col)}${row + 1}`);
  }

  getUsedRangeOrNullObject() {
    if (this.cells.size === 0 && this.shapes.items.length === 0) {
      return new FakeNullRange(this) as unknown as Excel.Range;
    }
    return new FakeRange(this, "A1", "used-range") as unknown as Excel.Range;
  }

  readMatrix(address: string, key: keyof CellState) {
    const parsed = parseAddress(address);
    const rows: unknown[][] = [];
    for (let row = parsed.startRow; row <= parsed.endRow; row++) {
      const rowValues: unknown[] = [];
      for (let col = parsed.startCol; col <= parsed.endCol; col++) {
        const cellAddress = `${indexToColumn(col)}${row + 1}`;
        rowValues.push(this.cells.get(cellAddress)?.[key] ?? "");
      }
      rows.push(rowValues);
    }
    return rows;
  }

  writeMatrix(address: string, key: keyof CellState, matrix: unknown[][]) {
    const parsed = parseAddress(address);
    for (let rowOffset = 0; rowOffset <= parsed.endRow - parsed.startRow; rowOffset++) {
      for (let colOffset = 0; colOffset <= parsed.endCol - parsed.startCol; colOffset++) {
        const row = parsed.startRow + rowOffset;
        const col = parsed.startCol + colOffset;
        const cellAddress = `${indexToColumn(col)}${row + 1}`;
        const cell = this.cells.get(cellAddress) ?? {};
        cell[key] = matrix[rowOffset]?.[colOffset] ?? "";
        this.cells.set(cellAddress, cell);
      }
    }
  }

  clearRange(address: string) {
    const parsed = parseAddress(address);
    for (let row = parsed.startRow; row <= parsed.endRow; row++) {
      for (let col = parsed.startCol; col <= parsed.endCol; col++) {
        this.cells.delete(`${indexToColumn(col)}${row + 1}`);
      }
    }
  }

  clear() {
    this.cells.clear();
    this.ranges.clear();
    this.shapes.items = [];
  }
}

class FakeWorksheets {
  items: FakeWorksheet[] = [];

  constructor(private readonly context: FakeRequestContext) {}

  load(_value: string) {}

  add(name: string) {
    const worksheet = new FakeWorksheet(this.context, name);
    this.items.push(worksheet);
    return worksheet as unknown as Excel.Worksheet;
  }

  getItemOrNullObject(name: string) {
    const worksheet = this.items.find((item) => item.name === name);
    if (worksheet) {
      return worksheet as unknown as Excel.Worksheet;
    }
    const nullSheet = new FakeWorksheet(this.context, name) as FakeWorksheet & { isNullObject: boolean };
    nullSheet.isNullObject = true;
    return nullSheet as unknown as Excel.Worksheet;
  }
}

class FakeWorkbook {
  worksheets: FakeWorksheets;

  constructor(context: FakeRequestContext) {
    this.worksheets = new FakeWorksheets(context);
  }
}

export class FakeRequestContext {
  workbook = new FakeWorkbook(this);

  async sync() {
    return undefined;
  }
}

export function installFakeExcel() {
  const context = new FakeRequestContext();
  const excel = {
    run: async <T>(callback: (context: FakeRequestContext) => Promise<T>) => callback(context),
    SheetVisibility: {
      hidden: "Hidden",
      veryHidden: "VeryHidden",
    },
    ClearApplyTo: {
      all: "All",
    },
  };

  (globalThis as { Excel?: unknown }).Excel = excel;
  return { context, excel };
}

export function getWorksheet(context: FakeRequestContext, name: string): FakeWorksheet | undefined {
  return context.workbook.worksheets.items.find((sheet) => sheet.name === name);
}

export function getRange(
  context: FakeRequestContext,
  sheetName: string,
  address: string
): FakeRange | undefined {
  return getWorksheet(context, sheetName)?.ranges.get(address);
}
