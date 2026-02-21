const BASE_URL = "http://localhost:3000"
const CHUNK_SIZE = 1024 * 1024 // 1MB

function generateCsv(rows: number, columns: number): Uint8Array {
  const headers = Array.from({ length: columns }, (_, i) =>
    i === 0 ? "id" : `col_${i}`
  )
  const lines = [headers.join(",")]

  for (let r = 1; r <= rows; r++) {
    const values = headers.map((h, i) => {
      if (i === 0) return String(r)
      if (i % 3 === 0) return String((Math.random() * 1000).toFixed(2))
      if (i % 3 === 1) return Math.random() > 0.5 ? "true" : "false"
      return `text_${r}_${i}`
    })
    lines.push(values.join(","))
  }

  return new TextEncoder().encode(lines.join("\n"))
}

function assert(condition: boolean, message: string) {
  if (!condition) {
    console.error(`  FAIL: ${message}`)
    process.exit(1)
  }
}

async function main() {
  console.log("=== Upload Smoke Test ===\n")

  // Step 1: Generate CSV
  const csv = generateCsv(50_000, 7)
  console.log(`1. Generated CSV: ${(csv.byteLength / 1024 / 1024).toFixed(1)} MB (50,000 rows x 7 columns)`)

  // Step 2: Init upload
  console.log("\n2. Init upload session")
  const initRes = await fetch(`${BASE_URL}/api/upload/init`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ filename: "smoke-test.csv", size: csv.byteLength }),
  })
  assert(initRes.ok, `Init failed with status ${initRes.status}`)
  const { sessionId } = (await initRes.json()) as { sessionId: string }
  console.log(`   Session: ${sessionId}`)

  // Step 3: Upload chunks
  const totalChunks = Math.ceil(csv.byteLength / CHUNK_SIZE)
  console.log(`\n3. Uploading ${totalChunks} chunks (${(CHUNK_SIZE / 1024).toFixed(0)} KB each)`)

  for (let i = 0; i < totalChunks; i++) {
    const start = i * CHUNK_SIZE
    const end = Math.min(start + CHUNK_SIZE, csv.byteLength)
    const chunk = csv.subarray(start, end)

    const chunkRes = await fetch(`${BASE_URL}/api/upload/chunk`, {
      method: "POST",
      headers: {
        "content-type": "application/octet-stream",
        "x-session-id": sessionId,
        "x-chunk-index": String(i),
        "x-total-chunks": String(totalChunks),
      },
      body: chunk,
    })
    assert(chunkRes.ok, `Chunk ${i} failed with status ${chunkRes.status}`)
    process.stdout.write(`   Chunk ${i + 1}/${totalChunks} OK\n`)
  }

  // Step 4: Finalize
  console.log("\n4. Finalize")
  const finRes = await fetch(`${BASE_URL}/api/upload/finalize`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ sessionId }),
  })
  assert(finRes.ok, `Finalize failed with status ${finRes.status}`)

  const result = (await finRes.json()) as {
    sessionId: string
    preview: { columns: string[]; types: Record<string, string>; rows: Array<Record<string, string>> }
  }

  // Step 5: Verify preview
  console.log("\n5. Verify preview")
  console.log(`   Columns: ${result.preview.columns.join(", ")}`)
  console.log(`   Types: ${JSON.stringify(result.preview.types)}`)
  console.log(`   Preview rows: ${result.preview.rows.length}`)

  assert(result.preview.columns.length === 7, `Expected 7 columns, got ${result.preview.columns.length}`)
  assert(result.preview.rows.length > 0, "Expected at least 1 preview row")
  assert(result.sessionId === sessionId, "Session ID mismatch")

  console.log("\n=== Smoke test PASSED ===")
}

main().catch((err) => {
  console.error("\n=== Smoke test FAILED ===")
  console.error(err)
  process.exit(1)
})
