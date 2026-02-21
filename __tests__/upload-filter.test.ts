import { describe, it, expect } from "vitest"
import { filterUploadableFiles } from "@/lib/csv-validator"

function createFile(name: string, content: string): File {
  return new File([content], name, { type: "text/csv" })
}

describe("filterUploadableFiles", () => {
  it("keeps valid CSV files with data", async () => {
    const files = [createFile("good.csv", "id,name\n1,Alice\n2,Bob\n")]
    const result = await filterUploadableFiles(files)
    expect(result.length).toBe(1)
    expect(result[0].name).toBe("good.csv")
  })

  it("removes invalid files", async () => {
    const files = [createFile("bad.csv", "   ")]
    const result = await filterUploadableFiles(files)
    expect(result.length).toBe(0)
  })

  it("removes headers-only files", async () => {
    const files = [createFile("headers-only.csv", "id,name,email,created_at,is_active,score\n")]
    const result = await filterUploadableFiles(files)
    expect(result.length).toBe(0)
  })

  it("removes all-empty-values files", async () => {
    const files = [createFile("empty-vals.csv", "id,name,email,phone\n,,,\n,,,\n,,,\n")]
    const result = await filterUploadableFiles(files)
    expect(result.length).toBe(0)
  })

  it("keeps no-header files (valid, just missing headers)", async () => {
    const files = [createFile("no-header.csv", "1,Alice,alice@test.com,30,true\n2,Bob,bob@test.com,25,false\n")]
    const result = await filterUploadableFiles(files)
    expect(result.length).toBe(1)
  })

  it("filters mixed set correctly", async () => {
    const files = [
      createFile("good.csv", "id,name\n1,Alice\n"),
      createFile("headers-only.csv", "id,name,email\n"),
      createFile("bad.csv", "   "),
      createFile("empty-vals.csv", "id,name\n,\n,\n"),
    ]
    const result = await filterUploadableFiles(files)
    expect(result.length).toBe(1)
    expect(result[0].name).toBe("good.csv")
  })
})
