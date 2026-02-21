import { describe, it, expect } from "vitest"
import { parseCsvPreview } from "@/lib/csv"

describe("parseCsvPreview", () => {
  it("parses normal CSV with headers correctly", () => {
    const csv = "id,name,email\n1,Alice,alice@test.com\n2,Bob,bob@test.com\n"
    const result = parseCsvPreview(csv, 100)
    expect(result.columns).toEqual(["id", "name", "email"])
    expect(result.rows.length).toBe(2)
    expect(result.rows[0]["id"]).toBe("1")
    expect(result.rows[0]["name"]).toBe("Alice")
    expect(result.hasHeader).toBe(true)
  })

  it("detects no-header CSV and includes all rows with synthetic columns", () => {
    const csv = "1,Alice,alice@test.com,30,true\n2,Bob,bob@test.com,25,false\n"
    const result = parseCsvPreview(csv, 100)
    expect(result.hasHeader).toBe(false)
    expect(result.columns).toEqual(["Column 1", "Column 2", "Column 3", "Column 4", "Column 5"])
    // Must NOT skip the first row
    expect(result.rows.length).toBe(2)
    expect(result.rows[0]["Column 1"]).toBe("1")
    expect(result.rows[0]["Column 2"]).toBe("Alice")
    expect(result.rows[1]["Column 1"]).toBe("2")
    expect(result.rows[1]["Column 2"]).toBe("Bob")
  })

  it("does not treat CSV with text-only headers as no-header", () => {
    const csv = "name,city,country\nAlice,NYC,US\nBob,London,UK\n"
    const result = parseCsvPreview(csv, 100)
    expect(result.hasHeader).toBe(true)
    expect(result.columns).toEqual(["name", "city", "country"])
    expect(result.rows.length).toBe(2)
  })

  it("deduplicates duplicate column names and preserves all data", () => {
    const csv = "id,amount,amount,name,amount\n1,100,200,Alice,300\n2,150,250,Bob,350\n"
    const result = parseCsvPreview(csv, 100)

    // Columns should be unique (suffixed with _2, _3, etc.)
    expect(result.columns).toEqual(["id", "amount", "amount_2", "name", "amount_3"])

    // All columns should be unique — no React key collisions
    expect(new Set(result.columns).size).toBe(result.columns.length)

    // All data should be preserved (no overwriting)
    expect(result.rows.length).toBe(2)
    expect(result.rows[0]["id"]).toBe("1")
    expect(result.rows[0]["amount"]).toBe("100")
    expect(result.rows[0]["amount_2"]).toBe("200")
    expect(result.rows[0]["name"]).toBe("Alice")
    expect(result.rows[0]["amount_3"]).toBe("300")
  })

  it("handles two duplicate columns without breaking other columns", () => {
    const csv = "a,b,a\n1,2,3\n"
    const result = parseCsvPreview(csv, 100)
    expect(result.columns).toEqual(["a", "b", "a_2"])
    expect(result.rows[0]["a"]).toBe("1")
    expect(result.rows[0]["b"]).toBe("2")
    expect(result.rows[0]["a_2"]).toBe("3")
  })

  it("handles quoted fields with embedded commas", () => {
    const csv = 'name,address,age\n"Smith, John","123 Main St, Apt 4",30\n'
    const result = parseCsvPreview(csv, 100)
    expect(result.columns).toEqual(["name", "address", "age"])
    expect(result.rows.length).toBe(1)
    expect(result.rows[0]["name"]).toBe("Smith, John")
    expect(result.rows[0]["address"]).toBe("123 Main St, Apt 4")
    expect(result.rows[0]["age"]).toBe("30")
  })

  it("handles quoted fields with embedded newlines", () => {
    const csv = 'id,note,value\n1,"line one\nline two",100\n2,"single line",200\n'
    const result = parseCsvPreview(csv, 100)
    expect(result.columns).toEqual(["id", "note", "value"])
    expect(result.rows.length).toBe(2)
    expect(result.rows[0]["note"]).toBe("line one\nline two")
    expect(result.rows[0]["value"]).toBe("100")
    expect(result.rows[1]["note"]).toBe("single line")
  })

  it("handles UTF-8 BOM prefix without corrupting the first header", () => {
    const csv = "\uFEFFid,name,score\n1,Alice,95\n"
    const result = parseCsvPreview(csv, 100)
    expect(result.columns).toEqual(["id", "name", "score"])
    expect(result.rows[0]["id"]).toBe("1")
  })
})
