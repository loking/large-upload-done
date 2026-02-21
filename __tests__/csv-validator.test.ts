import { describe, it, expect } from "vitest"
import { validateCsvContent } from "@/lib/csv-validator"

describe("validateCsvContent", () => {
  it("accepts valid CSV with headers and rows", () => {
    const result = validateCsvContent("id,name,score\n1,Alice,95\n2,Bob,87\n")
    expect(result.valid).toBe(true)
  })

  it("accepts CSV with only headers (no data rows)", () => {
    const result = validateCsvContent("id,name,email\n")
    expect(result.valid).toBe(true)
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
})
