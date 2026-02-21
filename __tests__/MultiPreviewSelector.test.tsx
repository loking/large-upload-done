import { render, screen, fireEvent } from "@testing-library/react"
import { describe, it, expect, vi } from "vitest"
import MultiPreviewSelector from "@/components/MultiPreviewSelector"

// Mock DataPreviewTable since it fetches from API
vi.mock("@/components/DataPreviewTable", () => ({
  default: ({ sessionId }: { sessionId: string }) => (
    <div data-testid="preview-table">Preview for {sessionId}</div>
  ),
}))

describe("MultiPreviewSelector", () => {
  const uploads = [
    { name: "sales.csv", sessionId: "sess-1" },
    { name: "users.csv", sessionId: "sess-2" },
    { name: "orders.csv", sessionId: "sess-3" },
  ]

  it("renders nothing when uploads list is empty", () => {
    const { container } = render(<MultiPreviewSelector uploads={[]} />)
    expect(container.innerHTML).toBe("")
  })

  it("renders preview directly when only one upload (no dropdown)", () => {
    render(<MultiPreviewSelector uploads={[uploads[0]]} />)
    expect(screen.getByTestId("preview-table")).toBeTruthy()
    expect(screen.getByText("Preview for sess-1")).toBeTruthy()
    expect(screen.queryByRole("combobox")).toBeNull()
  })

  it("renders a dropdown with all file names when multiple uploads", () => {
    render(<MultiPreviewSelector uploads={uploads} />)
    const select = screen.getByRole("combobox") as HTMLSelectElement
    expect(select).toBeTruthy()

    const options = select.querySelectorAll("option")
    expect(options.length).toBe(3)
    expect(options[0].textContent).toBe("sales.csv")
    expect(options[1].textContent).toBe("users.csv")
    expect(options[2].textContent).toBe("orders.csv")
  })

  it("shows preview for the first file by default", () => {
    render(<MultiPreviewSelector uploads={uploads} />)
    expect(screen.getByText("Preview for sess-1")).toBeTruthy()
  })

  it("switches preview when a different file is selected", () => {
    render(<MultiPreviewSelector uploads={uploads} />)
    const select = screen.getByRole("combobox")

    fireEvent.change(select, { target: { value: "1" } })
    expect(screen.getByText("Preview for sess-2")).toBeTruthy()

    fireEvent.change(select, { target: { value: "2" } })
    expect(screen.getByText("Preview for sess-3")).toBeTruthy()
  })

  it("renders an upload-another button that calls onUploadMore", () => {
    const onUploadMore = vi.fn()
    render(<MultiPreviewSelector uploads={uploads} onUploadMore={onUploadMore} />)
    const btn = screen.getByRole("button", { name: /upload more/i })
    fireEvent.click(btn)
    expect(onUploadMore).toHaveBeenCalledOnce()
  })
})
