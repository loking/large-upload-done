import { test, expect, type Page } from "@playwright/test"
import path from "path"

const PUBLIC_DIR = path.resolve(__dirname, "..", "public")
const FIXTURES_DIR = path.resolve(__dirname, "fixtures")

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function uploadFiles(page: Page, paths: string | string[]) {
  await page.locator('input[type="file"]').setInputFiles(paths)
}

async function waitForValidation(page: Page, index: number, expected: "true" | "false") {
  await expect(page.getByTestId(`file-status-${index}`)).toHaveAttribute(
    "data-valid",
    expected,
    { timeout: 15_000 },
  )
}

// ---------------------------------------------------------------------------
// Individual sample file uploads
// ---------------------------------------------------------------------------

test.describe("Individual sample file uploads", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/upload")
  })

  test("sample-small.csv — valid, no warnings, uploads successfully", async ({ page }) => {
    await uploadFiles(page, path.join(PUBLIC_DIR, "sample-small.csv"))

    // Validation: valid, no warnings
    await waitForValidation(page, 0, "true")
    await expect(page.getByTestId("file-warning-0")).not.toBeVisible()

    // Upload
    await page.getByRole("button", { name: "Start upload" }).click()

    // Success
    await expect(page.getByText("Upload complete")).toBeVisible({ timeout: 30_000 })

    // Preview rendered with expected columns
    await expect(page.getByText("Row Preview")).toBeVisible({ timeout: 10_000 })
    for (const col of ["id", "name", "amount", "active"]) {
      await expect(page.getByRole("columnheader", { name: col })).toBeVisible()
    }
  })

  test("sample-large.csv — valid, no warnings, shows chunk progress", async ({ page }) => {
    test.setTimeout(180_000) // 31 MB upload

    await uploadFiles(page, path.join(PUBLIC_DIR, "sample-large.csv"))

    await waitForValidation(page, 0, "true")
    await expect(page.getByTestId("file-warning-0")).not.toBeVisible()

    await page.getByRole("button", { name: "Start upload" }).click()

    // Progress UI visible during upload
    await expect(page.getByText(/Chunk \d+ of \d+/)).toBeVisible({ timeout: 30_000 })

    // Final success
    await expect(page.getByText("Upload complete")).toBeVisible({ timeout: 180_000 })
    await expect(page.getByText("Row Preview")).toBeVisible({ timeout: 15_000 })
  })

  test("sample-wrong.csv — duplicate-columns warning, still uploads", async ({ page }) => {
    test.setTimeout(180_000) // 31 MB upload

    await uploadFiles(page, path.join(PUBLIC_DIR, "sample-wrong.csv"))

    await waitForValidation(page, 0, "true")

    // Warning shown
    await expect(page.getByText("Duplicate column names detected")).toBeVisible()

    // Still uploadable
    await page.getByRole("button", { name: "Start upload" }).click()

    await expect(page.getByText("Upload complete")).toBeVisible({ timeout: 180_000 })
    await expect(page.getByText("Row Preview")).toBeVisible({ timeout: 15_000 })
  })
})

// ---------------------------------------------------------------------------
// Invalid / failure file handling
// ---------------------------------------------------------------------------

test.describe("Invalid file handling (fail behaviors)", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/upload")
  })

  test("empty CSV — rejected as invalid, Start upload disabled", async ({ page }) => {
    await uploadFiles(page, path.join(FIXTURES_DIR, "empty.csv"))

    await waitForValidation(page, 0, "false")
    await expect(page.getByText("Not a valid CSV file")).toBeVisible()

    await expect(page.getByRole("button", { name: "Start upload" })).toBeDisabled()
  })

  test("non-UTF-8 CSV — rejected with encoding error + help link", async ({ page }) => {
    await uploadFiles(page, path.join(FIXTURES_DIR, "non-utf8.csv"))

    await waitForValidation(page, 0, "false")
    await expect(page.getByText("File is not UTF-8 encoded")).toBeVisible()
    await expect(page.getByText("How to fix")).toBeVisible()

    await expect(page.getByRole("button", { name: "Start upload" })).toBeDisabled()
  })

  test("JSON masquerading as CSV — rejected as invalid", async ({ page }) => {
    await uploadFiles(page, path.join(FIXTURES_DIR, "not-csv.csv"))

    await waitForValidation(page, 0, "false")
    await expect(page.getByText("Not a valid CSV file")).toBeVisible()

    await expect(page.getByRole("button", { name: "Start upload" })).toBeDisabled()
  })

  test("headers-only CSV — no-data warning, not uploadable", async ({ page }) => {
    await uploadFiles(page, path.join(FIXTURES_DIR, "headers-only.csv"))

    await waitForValidation(page, 0, "true")
    await expect(page.getByText("No data rows")).toBeVisible()

    // Valid but not uploadable → button stays disabled
    await expect(page.getByRole("button", { name: "Start upload" })).toBeDisabled()
  })
})

// ---------------------------------------------------------------------------
// Multi-file upload — all sample_* files together
// ---------------------------------------------------------------------------

test.describe("Multi-file upload (sample_* together)", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/upload")
  })

  test("upload all three sample files — correct per-file validation, sequential upload, preview selector", async ({
    page,
  }) => {
    test.setTimeout(300_000) // two 31 MB files + one small

    // Select all sample files at once
    await uploadFiles(page, [
      path.join(PUBLIC_DIR, "sample-small.csv"),
      path.join(PUBLIC_DIR, "sample-large.csv"),
      path.join(PUBLIC_DIR, "sample-wrong.csv"),
    ])

    // --- Per-file validation ---
    // All three should be valid
    await waitForValidation(page, 0, "true") // sample-small
    await waitForValidation(page, 1, "true") // sample-large
    await waitForValidation(page, 2, "true") // sample-wrong

    // sample-small and sample-large have no warnings
    await expect(page.getByTestId("file-warning-0")).not.toBeVisible()
    await expect(page.getByTestId("file-warning-1")).not.toBeVisible()

    // sample-wrong has duplicate-columns warning
    await expect(page.getByText("Duplicate column names detected")).toBeVisible()

    // --- Start sequential upload ---
    await page.getByRole("button", { name: "Start upload" }).click()

    // Multi-file progress indicator (e.g. "file 1 of 3")
    await expect(page.getByText(/file \d+ of 3/)).toBeVisible({ timeout: 30_000 })

    // --- Wait for all done ---
    await expect(page.getByText("All 3 files uploaded")).toBeVisible({ timeout: 300_000 })
    await expect(
      page.getByText("All files have been uploaded and processed successfully."),
    ).toBeVisible()

    // --- Preview selector ---
    const selector = page.locator("select")
    await expect(selector).toBeVisible()
    await expect(selector.locator("option")).toHaveCount(3)

    // Preview table loads for default (first) file
    await expect(page.getByText("Row Preview")).toBeVisible({ timeout: 15_000 })

    // Switch to each file in the selector and verify preview loads
    for (let i = 0; i < 3; i++) {
      await selector.selectOption({ index: i })
      await expect(page.getByText("Row Preview")).toBeVisible({ timeout: 15_000 })
    }
  })

  test("mixed valid + invalid files — only valid files upload, invalid skipped", async ({
    page,
  }) => {
    // Upload a valid file and an invalid file together
    await uploadFiles(page, [
      path.join(PUBLIC_DIR, "sample-small.csv"),
      path.join(FIXTURES_DIR, "empty.csv"),
    ])

    // sample-small.csv → valid
    await waitForValidation(page, 0, "true")
    // empty.csv → invalid
    await waitForValidation(page, 1, "false")
    await expect(page.getByText("Not a valid CSV file")).toBeVisible()

    // Start button enabled because there is at least one uploadable file
    const startButton = page.getByRole("button", { name: "Start upload" })
    await expect(startButton).toBeEnabled()

    // Upload — only the valid file proceeds
    await startButton.click()

    // Single valid file → "Upload complete" (not "All N files")
    await expect(page.getByText("Upload complete")).toBeVisible({ timeout: 30_000 })
    await expect(page.getByText("Row Preview")).toBeVisible({ timeout: 10_000 })
  })

  test("mixed valid + headers-only — headers-only skipped, valid uploads", async ({ page }) => {
    await uploadFiles(page, [
      path.join(PUBLIC_DIR, "sample-small.csv"),
      path.join(FIXTURES_DIR, "headers-only.csv"),
    ])

    await waitForValidation(page, 0, "true")
    await waitForValidation(page, 1, "true")

    // headers-only shows no-data warning
    await expect(page.getByText("No data rows")).toBeVisible()

    // Start button enabled (sample-small is uploadable)
    await page.getByRole("button", { name: "Start upload" }).click()

    // Only sample-small uploads
    await expect(page.getByText("Upload complete")).toBeVisible({ timeout: 30_000 })
    await expect(page.getByText("Row Preview")).toBeVisible({ timeout: 10_000 })
  })

  test("all invalid files — Start upload stays disabled", async ({ page }) => {
    await uploadFiles(page, [
      path.join(FIXTURES_DIR, "empty.csv"),
      path.join(FIXTURES_DIR, "non-utf8.csv"),
    ])

    await waitForValidation(page, 0, "false")
    await waitForValidation(page, 1, "false")

    await expect(page.getByRole("button", { name: "Start upload" })).toBeDisabled()
  })

  test("remove file from pending list before upload", async ({ page }) => {
    await uploadFiles(page, [
      path.join(PUBLIC_DIR, "sample-small.csv"),
      path.join(FIXTURES_DIR, "empty.csv"),
    ])

    await waitForValidation(page, 0, "true")
    await waitForValidation(page, 1, "false")

    // Remove the invalid file
    await page.getByRole("button", { name: "Remove empty.csv" }).click()

    // Only one file left, and it's valid
    await expect(page.getByTestId("file-status-0")).toHaveAttribute("data-valid", "true")
    await expect(page.getByTestId("file-status-1")).not.toBeVisible()

    // Upload succeeds
    await page.getByRole("button", { name: "Start upload" }).click()
    await expect(page.getByText("Upload complete")).toBeVisible({ timeout: 30_000 })
  })
})
