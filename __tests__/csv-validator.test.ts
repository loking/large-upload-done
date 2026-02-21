import { describe, it, expect } from "vitest"
import { validateCsvContent, isUploadable } from "@/lib/csv-validator"

describe("validateCsvContent", () => {
  it("accepts valid CSV with headers and rows", () => {
    const result = validateCsvContent("id,name,score\n1,Alice,95\n2,Bob,87\n")
    expect(result.valid).toBe(true)
  })

  it("returns valid with no-data warning when CSV has only headers", () => {
    const result = validateCsvContent("id,name,email,created_at,is_active,score\n")
    expect(result.valid).toBe(true)
    expect(result).toHaveProperty("warnings")
    if (result.valid) {
      expect(result.warnings).toContain("no-data")
    }
  })

  it("returns valid with no-data warning when all values are empty", () => {
    const csv = "id,name,email,phone\n,,,\n,,,\n,,,\n"
    const result = validateCsvContent(csv)
    expect(result.valid).toBe(true)
    expect(result).toHaveProperty("warnings")
    if (result.valid) {
      expect(result.warnings).toContain("no-data")
    }
  })

  it("accepts single-column CSV", () => {
    const result = validateCsvContent("name\nAlice\nBob\n")
    expect(result.valid).toBe(true)
  })

  it("accepts CSV with empty rows interspersed", () => {
    const result = validateCsvContent("id,name,score\n\n1,Alice,95\n\n2,Bob,87\n")
    expect(result.valid).toBe(true)
  })

  it("rejects empty file", () => {
    const result = validateCsvContent("")
    expect(result.valid).toBe(false)
  })

  it("rejects whitespace-only file", () => {
    const result = validateCsvContent("   \n  \n  ")
    expect(result.valid).toBe(false)
  })

  it("rejects JSON content", () => {
    const result = validateCsvContent('{"users": [{"id": 1, "name": "Alice"}]}')
    expect(result.valid).toBe(false)
  })

  it("rejects single value with no delimiter", () => {
    const result = validateCsvContent("just-a-random-string")
    expect(result.valid).toBe(false)
  })

  it("returns valid with no-header warning when first row looks like data", () => {
    const csv = "1,Alice,alice@test.com,30,true\n2,Bob,bob@test.com,25,false\n"
    const result = validateCsvContent(csv)
    expect(result.valid).toBe(true)
    expect(result).toHaveProperty("warnings")
    if (result.valid) {
      expect(result.warnings).toContain("no-header")
    }
  })

  it("does not return no-header warning for normal CSV with headers", () => {
    const csv = "id,name,email,age,active\n1,Alice,alice@test.com,30,true\n"
    const result = validateCsvContent(csv)
    expect(result.valid).toBe(true)
    if (result.valid) {
      expect(result.warnings ?? []).not.toContain("no-header")
    }
  })

  it("returns valid with duplicate-columns warning for CSV with repeated column names", () => {
    const csv = "id,amount,amount,name,amount\n1,100,200,Alice,300\n"
    const result = validateCsvContent(csv)
    expect(result.valid).toBe(true)
    expect(result).toHaveProperty("warnings")
    if (result.valid) {
      expect(result.warnings).toContain("duplicate-columns")
    }
  })

  it("does not return duplicate-columns warning for unique column names", () => {
    const csv = "id,name,email\n1,Alice,a@test.com\n"
    const result = validateCsvContent(csv)
    expect(result.valid).toBe(true)
    if (result.valid) {
      expect(result.warnings ?? []).not.toContain("duplicate-columns")
    }
  })

  it("does not return no-data warning for CSV with actual data", () => {
    const csv = "id,name\n1,Alice\n2,Bob\n"
    const result = validateCsvContent(csv)
    expect(result.valid).toBe(true)
    if (result.valid) {
      expect(result.warnings ?? []).not.toContain("no-data")
    }
  })

  it("returns valid with mixed-types warning when a column has inconsistent types", () => {
    const csv = "id,value,flag,date\n1,100,true,2024-01-15\n2,hello,false,2024-02-20\n3,300,maybe,not-a-date\n"
    const result = validateCsvContent(csv)
    expect(result.valid).toBe(true)
    expect(result).toHaveProperty("warnings")
    if (result.valid) {
      expect(result.warnings).toContain("mixed-types")
    }
  })

  it("does not return mixed-types warning when all columns have consistent types", () => {
    const csv = "id,name,score\n1,Alice,95\n2,Bob,87\n3,Carol,92\n"
    const result = validateCsvContent(csv)
    expect(result.valid).toBe(true)
    if (result.valid) {
      expect(result.warnings ?? []).not.toContain("mixed-types")
    }
  })
})

describe("isUploadable", () => {
  it("returns true for valid CSV with data", () => {
    expect(isUploadable({ valid: true })).toBe(true)
  })

  it("returns true for valid CSV with no-header warning", () => {
    expect(isUploadable({ valid: true, warnings: ["no-header"] })).toBe(true)
  })

  it("returns false for invalid CSV", () => {
    expect(isUploadable({ valid: false, error: "Not a valid CSV file" })).toBe(false)
  })

  it("returns false for valid CSV with no-data warning", () => {
    expect(isUploadable({ valid: true, warnings: ["no-data"] })).toBe(false)
  })

  it("returns false for valid CSV with both no-header and no-data warnings", () => {
    expect(isUploadable({ valid: true, warnings: ["no-header", "no-data"] })).toBe(false)
  })

  it("returns true for valid CSV with duplicate-columns warning", () => {
    expect(isUploadable({ valid: true, warnings: ["duplicate-columns"] })).toBe(true)
  })

  it("returns true for valid CSV with mixed-types warning", () => {
    expect(isUploadable({ valid: true, warnings: ["mixed-types"] })).toBe(true)
  })
})
