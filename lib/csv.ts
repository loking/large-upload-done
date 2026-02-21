import Papa from "papaparse"

export function parseCsvPreview(csvText: string, maxRows: number) {
  // Use PapaParse without header mode first to inspect the raw first row
  const raw = Papa.parse<string[]>(csvText, {
    header: false,
    preview: maxRows + 1,
    skipEmptyLines: true,
  })

  const firstRow = raw.data[0]
  if (!firstRow || firstRow.length === 0) {
    return { columns: [], rows: [], types: {}, hasHeader: false }
  }

  const hasHeader = !looksLikeDataRow(firstRow)

  let columns: string[]
  let dataRows: string[][]

  if (hasHeader) {
    columns = deduplicateColumns(firstRow)
    dataRows = raw.data.slice(1)
  } else {
    columns = firstRow.map((_, i) => `Column ${i + 1}`)
    dataRows = raw.data
  }

  const rows: Record<string, string>[] = dataRows.map((vals) => {
    const row: Record<string, string> = {}
    for (let c = 0; c < columns.length; c++) row[columns[c]!] = vals[c] ?? ""
    return row
  })

  const types: Record<string, string> = {}
  for (const col of columns) {
    const sample = rows.map((r) => r[col]).filter((x) => x !== "").slice(0, 50)
    types[col] = inferType(sample)
  }

  return { columns, rows, types, hasHeader }
}

function deduplicateColumns(columns: string[]): string[] {
  const seen = new Map<string, number>()
  return columns.map((col) => {
    const count = seen.get(col) ?? 0
    seen.set(col, count + 1)
    if (count === 0) return col
    return `${col}_${count + 1}`
  })
}

function looksLikeDataRow(values: string[]): boolean {
  return values.some(
    (v) => /^-?\d+(\.\d+)?$/.test(v.trim()) || /^(true|false)$/i.test(v.trim())
  )
}

function inferType(sample: string[]) {
  if (sample.length === 0) return "unknown"
  const isNumber = sample.every((v) => /^-?\d+(\.\d+)?$/.test(v.trim()))
  if (isNumber) return "number"
  const isBool = sample.every((v) => /^(true|false)$/i.test(v.trim()))
  if (isBool) return "boolean"
  return "string"
}

