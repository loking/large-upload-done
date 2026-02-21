import { render, screen, fireEvent, waitFor } from "@testing-library/react"
import { describe, it, expect, vi } from "vitest"
import PendingFileList from "@/components/PendingFileList"

function createFile(name: string, content: string): File {
  return new File([content], name, { type: "text/csv" })
}

describe("PendingFileList", () => {
  it("renders nothing when list is empty", () => {
    const { container } = render(
      <PendingFileList files={[]} onRemove={vi.fn()} onStart={vi.fn()} />
    )
    expect(container.querySelector("[data-testid='pending-file-list']")).toBeNull()
  })

  it("renders file names with validation status", async () => {
    const files = [
      createFile("valid.csv", "id,name\n1,Alice\n"),
      createFile("bad.csv", "   "),
    ]
    render(<PendingFileList files={files} onRemove={vi.fn()} onStart={vi.fn()} />)

    // Files appear immediately
    expect(screen.getByText(/valid\.csv/)).toBeTruthy()
    expect(screen.getByText(/bad\.csv/)).toBeTruthy()

    // After async validation, bad file should show invalid indicator
    await waitFor(() => {
      expect(screen.getByTestId("file-status-1").dataset.valid).toBe("false")
    })
    // Valid file should be marked valid
    await waitFor(() => {
      expect(screen.getByTestId("file-status-0").dataset.valid).toBe("true")
    })
  })

  it("shows error message for invalid files", async () => {
    const files = [createFile("bad.csv", "   ")]
    render(<PendingFileList files={files} onRemove={vi.fn()} onStart={vi.fn()} />)

    await waitFor(() => {
      expect(screen.getByText(/not a valid csv/i)).toBeTruthy()
    })
  })

  it("calls onRemove with index when remove button is clicked", () => {
    const onRemove = vi.fn()
    const files = [createFile("a.csv", "id\n1\n"), createFile("b.csv", "id\n2\n")]
    render(<PendingFileList files={files} onRemove={onRemove} onStart={vi.fn()} />)

    const removeButtons = screen.getAllByLabelText(/remove/i)
    fireEvent.click(removeButtons[1])
    expect(onRemove).toHaveBeenCalledWith(1)
  })

  it("disables start button when all files are invalid", async () => {
    const onStart = vi.fn()
    const files = [createFile("bad.csv", "   ")]
    render(<PendingFileList files={files} onRemove={vi.fn()} onStart={onStart} />)

    await waitFor(() => {
      expect(screen.getByTestId("file-status-0").dataset.valid).toBe("false")
    })

    const startBtn = screen.getByRole("button", { name: /start upload/i })
    expect(startBtn.hasAttribute("disabled")).toBe(true)

    fireEvent.click(startBtn)
    expect(onStart).not.toHaveBeenCalled()
  })

  it("start button is enabled when at least one file is valid", async () => {
    const onStart = vi.fn()
    const files = [
      createFile("good.csv", "id,name\n1,Alice\n"),
      createFile("bad.csv", "   "),
    ]
    render(<PendingFileList files={files} onRemove={vi.fn()} onStart={onStart} />)

    await waitFor(() => {
      expect(screen.getByTestId("file-status-0").dataset.valid).toBe("true")
    })

    const startBtn = screen.getByRole("button", { name: /start upload/i })
    expect(startBtn.hasAttribute("disabled")).toBe(false)

    fireEvent.click(startBtn)
    expect(onStart).toHaveBeenCalledOnce()
  })

  it("shows warning icon for valid file with no-header warning", async () => {
    const files = [createFile("no-header.csv", "1,Alice,alice@test.com,30,true\n2,Bob,bob@test.com,25,false\n")]
    render(<PendingFileList files={files} onRemove={vi.fn()} onStart={vi.fn()} />)

    // File should still be valid
    await waitFor(() => {
      expect(screen.getByTestId("file-status-0").dataset.valid).toBe("true")
    })

    // Should show a warning indicator
    expect(screen.getByTestId("file-warning-0")).toBeTruthy()
    expect(screen.getByTestId("file-warning-0").textContent).toMatch(/no header/i)
  })

  it("does not show warning icon for normal valid CSV", async () => {
    const files = [createFile("good.csv", "id,name\n1,Alice\n")]
    render(<PendingFileList files={files} onRemove={vi.fn()} onStart={vi.fn()} />)

    await waitFor(() => {
      expect(screen.getByTestId("file-status-0").dataset.valid).toBe("true")
    })

    expect(screen.queryByTestId("file-warning-0")).toBeNull()
  })

  it("allows upload of files with no-header warning (start button enabled)", async () => {
    const onStart = vi.fn()
    const files = [createFile("no-header.csv", "1,Alice,alice@test.com,30,true\n2,Bob,bob@test.com,25,false\n")]
    render(<PendingFileList files={files} onRemove={vi.fn()} onStart={onStart} />)

    await waitFor(() => {
      expect(screen.getByTestId("file-status-0").dataset.valid).toBe("true")
    })

    const startBtn = screen.getByRole("button", { name: /start upload/i })
    expect(startBtn.hasAttribute("disabled")).toBe(false)

    fireEvent.click(startBtn)
    expect(onStart).toHaveBeenCalledOnce()
  })

  it("shows warning for headers-only CSV and disables start button", async () => {
    const onStart = vi.fn()
    const files = [createFile("headers-only.csv", "id,name,email,created_at,is_active,score\n")]
    render(<PendingFileList files={files} onRemove={vi.fn()} onStart={onStart} />)

    await waitFor(() => {
      expect(screen.getByTestId("file-status-0").dataset.valid).toBe("true")
    })

    // Should show warning
    expect(screen.getByTestId("file-warning-0")).toBeTruthy()
    expect(screen.getByTestId("file-warning-0").textContent).toMatch(/no data/i)

    // Start button should be disabled — file is skipped like invalid
    const startBtn = screen.getByRole("button", { name: /start upload/i })
    expect(startBtn.hasAttribute("disabled")).toBe(true)

    fireEvent.click(startBtn)
    expect(onStart).not.toHaveBeenCalled()
  })

  it("shows warning for all-empty-values CSV and disables start button", async () => {
    const onStart = vi.fn()
    const files = [createFile("empty-vals.csv", "id,name,email,phone\n,,,\n,,,\n,,,\n")]
    render(<PendingFileList files={files} onRemove={vi.fn()} onStart={onStart} />)

    await waitFor(() => {
      expect(screen.getByTestId("file-status-0").dataset.valid).toBe("true")
    })

    expect(screen.getByTestId("file-warning-0")).toBeTruthy()
    expect(screen.getByTestId("file-warning-0").textContent).toMatch(/no data/i)

    const startBtn = screen.getByRole("button", { name: /start upload/i })
    expect(startBtn.hasAttribute("disabled")).toBe(true)

    fireEvent.click(startBtn)
    expect(onStart).not.toHaveBeenCalled()
  })

  it("enables start button when mix of uploadable and no-data files", async () => {
    const onStart = vi.fn()
    const files = [
      createFile("good.csv", "id,name\n1,Alice\n"),
      createFile("headers-only.csv", "id,name,email\n"),
    ]
    render(<PendingFileList files={files} onRemove={vi.fn()} onStart={onStart} />)

    await waitFor(() => {
      expect(screen.getByTestId("file-status-0").dataset.valid).toBe("true")
      expect(screen.getByTestId("file-status-1").dataset.valid).toBe("true")
    })

    const startBtn = screen.getByRole("button", { name: /start upload/i })
    expect(startBtn.hasAttribute("disabled")).toBe(false)

    fireEvent.click(startBtn)
    expect(onStart).toHaveBeenCalledOnce()
  })

  it("shows warning for duplicate columns but allows upload", async () => {
    const onStart = vi.fn()
    const files = [createFile("dupes.csv", "id,amount,amount,name,amount\n1,100,200,Alice,300\n")]
    render(<PendingFileList files={files} onRemove={vi.fn()} onStart={onStart} />)

    await waitFor(() => {
      expect(screen.getByTestId("file-status-0").dataset.valid).toBe("true")
    })

    // Should show warning about duplicate columns
    expect(screen.getByTestId("file-warning-0")).toBeTruthy()
    expect(screen.getByTestId("file-warning-0").textContent).toMatch(/duplicate col/i)

    // Start button should be ENABLED — file is still uploadable
    const startBtn = screen.getByRole("button", { name: /start upload/i })
    expect(startBtn.hasAttribute("disabled")).toBe(false)

    fireEvent.click(startBtn)
    expect(onStart).toHaveBeenCalledOnce()
  })

  it("does not render start button or file items when hidden prop is true", () => {
    const files = [createFile("a.csv", "id\n1\n")]
    const { container } = render(
      <PendingFileList files={files} onRemove={vi.fn()} onStart={vi.fn()} hidden />
    )
    expect(container.querySelector("[data-testid='pending-file-list']")).toBeNull()
  })
})
