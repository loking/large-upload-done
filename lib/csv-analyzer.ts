export type ColumnStats = {
  name: string
  inferredType: 'number' | 'boolean' | 'string' | 'date' | 'unknown'
  emptyCount: number
  totalCount: number
  sampleValues: string[]
  numericRange?: { min: number; max: number }
  warnings: string[]
}

export function analyzeColumns(
  columns: string[],
  rows: Array<Record<string, string>>
): ColumnStats[] {
  return columns.map((name) => {
    const values = rows.map((r) => r[name] ?? '')
    const nonEmpty = values.filter((v) => v.trim() !== '')
    const emptyCount = values.length - nonEmpty.length
    const totalCount = values.length

    const inferredType = inferColumnType(nonEmpty)

    const uniqueSamples = [...new Set(nonEmpty)].slice(0, 5)

    let numericRange: { min: number; max: number } | undefined
    if (inferredType === 'number' && nonEmpty.length > 0) {
      const nums = nonEmpty.map((v) => parseFloat(v))
      numericRange = { min: Math.min(...nums), max: Math.max(...nums) }
    }

    const warnings: string[] = []
    if (totalCount > 0 && emptyCount / totalCount > 0.2) {
      warnings.push(`${Math.round((emptyCount / totalCount) * 100)}% of values are empty`)
    }

    return {
      name,
      inferredType,
      emptyCount,
      totalCount,
      sampleValues: uniqueSamples,
      numericRange,
      warnings,
    }
  })
}

function inferColumnType(
  nonEmpty: string[]
): ColumnStats['inferredType'] {
  if (nonEmpty.length === 0) return 'unknown'

  const trimmed = nonEmpty.map((v) => v.trim())

  if (trimmed.every((v) => /^-?\d+(\.\d+)?$/.test(v))) {
    return 'number'
  }

  if (trimmed.every((v) => /^(true|false)$/i.test(v))) {
    return 'boolean'
  }

  if (trimmed.every((v) => isPlausibleDate(v))) {
    return 'date'
  }

  return 'string'
}

function isPlausibleDate(v: string): boolean {
  if (v.length < 8) return false
  const parsed = Date.parse(v)
  if (isNaN(parsed)) return false
  const year = new Date(parsed).getFullYear()
  return year >= 1900 && year <= 2100
}
