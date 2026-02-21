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

  return warnings.length > 0 ? { valid: true, warnings } : { valid: true }
}

function looksLikeDataRow(fields: string[]): boolean {
  return fields.some(
    (f) => /^-?\d+(\.\d+)?$/.test(f.trim()) || /^(true|false)$/i.test(f.trim())
  )
}

export async function validateCsvFile(file: File): Promise<CsvValidationResult> {
  const HEAD_SIZE = 8192
  const slice = file.slice(0, HEAD_SIZE)
  const text = await slice.text()
  return validateCsvContent(text)
}
