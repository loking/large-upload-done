import Papa from "papaparse"

export type CsvValidationResult =
  | { valid: true; warnings?: string[] }
  | { valid: false; error: string }

const NOT_VALID = "Not a valid CSV file"

export function validateCsvContent(content: string): CsvValidationResult {
  if (content.trim().length === 0) {
    return { valid: false, error: NOT_VALID }
  }

  const result = Papa.parse(content, {
    header: true,
    preview: 10,
    skipEmptyLines: true,
  })

  // Ignore UndetectableDelimiter — it fires for single-column CSVs
  const realErrors = result.errors.filter((e) => e.code !== "UndetectableDelimiter")
  if (realErrors.length > 0) {
    return { valid: false, error: NOT_VALID }
  }

  const fields = result.meta.fields
  if (!fields || fields.length === 0) {
    return { valid: false, error: NOT_VALID }
  }

  // A single-column header with no data rows is not useful CSV
  if (fields.length < 2 && result.data.length === 0) {
    return { valid: false, error: NOT_VALID }
  }

  // Column names containing structural characters like { or [ indicate
  // the file is not actually CSV (e.g. JSON parsed by comma-splitting)
  if (fields.some((f) => /[{[\]}<>]/.test(f))) {
    return { valid: false, error: NOT_VALID }
  }

  const warnings: string[] = []
  if (looksLikeDataRow(fields)) {
    warnings.push("no-header")
  }

  // Check raw header line for duplicates (PapaParse auto-renames them)
  const rawHeaders = content.trim().split(/\r?\n/)[0]!.split(",").map((h) => h.trim())
  if (new Set(rawHeaders).size < rawHeaders.length) {
    warnings.push("duplicate-columns")
  }

  const rows = result.data as Record<string, string>[]
  if (rows.length === 0 || rows.every((row) => Object.values(row).every((v) => v.trim() === ""))) {
    warnings.push("no-data")
  }

  if (rows.length >= 2 && hasMixedTypes(rows, fields)) {
    warnings.push("mixed-types")
  }

  return warnings.length > 0 ? { valid: true, warnings } : { valid: true }
}

export function isUploadable(result: CsvValidationResult): boolean {
  if (!result.valid) return false
  return !result.warnings?.includes("no-data")
}

function inferType(value: string): "number" | "boolean" | "empty" | "string" {
  const v = value.trim()
  if (v === "") return "empty"
  if (/^-?\d+(\.\d+)?$/.test(v)) return "number"
  if (/^(true|false)$/i.test(v)) return "boolean"
  return "string"
}

function hasMixedTypes(rows: Record<string, string>[], fields: string[]): boolean {
  for (const field of fields) {
    const types = new Set<string>()
    for (const row of rows) {
      const t = inferType(row[field] ?? "")
      if (t !== "empty") types.add(t)
    }
    if (types.size > 1) return true
  }
  return false
}

function looksLikeDataRow(fields: string[]): boolean {
  return fields.some(
    (f) => /^-?\d+(\.\d+)?$/.test(f.trim()) || /^(true|false)$/i.test(f.trim())
  )
}

export async function filterUploadableFiles(files: File[]): Promise<File[]> {
  const results = await Promise.all(
    files.map((f) => validateCsvFile(f).then((r) => ({ file: f, result: r })))
  )
  return results.filter((r) => isUploadable(r.result)).map((r) => r.file)
}

export async function validateCsvFile(file: File): Promise<CsvValidationResult> {
  const HEAD_SIZE = 8192
  const slice = file.slice(0, HEAD_SIZE)
  const text = await slice.text()
  return validateCsvContent(text)
}
