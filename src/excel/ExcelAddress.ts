export function colLetter(col: number): string {
  let s = "";
  let c = col;
  while (c >= 0) {
    s = String.fromCharCode(65 + (c % 26)) + s;
    c = Math.floor(c / 26) - 1;
  }
  return s;
}

export function cellAddr(col: number, row: number): string {
  return `${colLetter(col)}${row + 1}`;
}

export function rangeAddr(
  col: number,
  row: number,
  cols: number,
  rows: number
): string {
  return `${cellAddr(col, row)}:${cellAddr(col + cols - 1, row + rows - 1)}`;
}

export function quoteSheetName(sheetName: string): string {
  return `'${sheetName.replace(/'/g, "''")}'`;
}
