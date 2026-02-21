import { render, screen, fireEvent } from "@testing-library/react"
import { describe, it, expect, vi } from "vitest"
import DropZone from "@/components/DropZone"

function createFile(name: string, size: number, type: string): File {
  const content = new ArrayBuffer(size)
  return new File([content], name, { type })
}

describe("DropZone", () => {
  it("renders a drop zone with prompt text", () => {
    render(<DropZone onFilesSelected={vi.fn()} />)
    expect(screen.getByText(/drag.*drop/i)).toBeTruthy()
  })

  it("renders a hidden file input that accepts CSV and multiple files", () => {
    render(<DropZone onFilesSelected={vi.fn()} />)
    const input = document.querySelector('input[type="file"]') as HTMLInputElement
    expect(input).toBeTruthy()
    expect(input.accept).toBe(".csv,text/csv")
    expect(input.multiple).toBe(true)
  })

  it("calls onFilesSelected when files are selected via input", () => {
    const onFilesSelected = vi.fn()
    render(<DropZone onFilesSelected={onFilesSelected} />)
    const input = document.querySelector('input[type="file"]') as HTMLInputElement

    const file = createFile("test.csv", 1024, "text/csv")
    fireEvent.change(input, { target: { files: [file] } })

    expect(onFilesSelected).toHaveBeenCalledWith([file])
  })

  it("calls onFilesSelected with multiple files", () => {
    const onFilesSelected = vi.fn()
    render(<DropZone onFilesSelected={onFilesSelected} />)
    const input = document.querySelector('input[type="file"]') as HTMLInputElement

    const file1 = createFile("a.csv", 100, "text/csv")
    const file2 = createFile("b.csv", 200, "text/csv")
    fireEvent.change(input, { target: { files: [file1, file2] } })

    expect(onFilesSelected).toHaveBeenCalledWith([file1, file2])
  })

  it("shows drag-over visual state on dragenter and removes on dragleave", () => {
    render(<DropZone onFilesSelected={vi.fn()} />)
    const zone = screen.getByTestId("dropzone")

    fireEvent.dragEnter(zone, { dataTransfer: { types: ["Files"] } })
    expect(zone.dataset.dragover).toBe("true")

    fireEvent.dragLeave(zone)
    expect(zone.dataset.dragover).toBe("false")
  })

  it("calls onFilesSelected when files are dropped", () => {
    const onFilesSelected = vi.fn()
    render(<DropZone onFilesSelected={onFilesSelected} />)
    const zone = screen.getByTestId("dropzone")

    const file = createFile("dropped.csv", 512, "text/csv")
    fireEvent.drop(zone, {
      dataTransfer: { files: [file] },
    })

    expect(onFilesSelected).toHaveBeenCalledWith([file])
  })

  it("resets drag-over state after drop", () => {
    render(<DropZone onFilesSelected={vi.fn()} />)
    const zone = screen.getByTestId("dropzone")

    fireEvent.dragEnter(zone, { dataTransfer: { types: ["Files"] } })
    expect(zone.dataset.dragover).toBe("true")

    const file = createFile("x.csv", 100, "text/csv")
    fireEvent.drop(zone, { dataTransfer: { files: [file] } })
    expect(zone.dataset.dragover).toBe("false")
  })

  it("is disabled when disabled prop is true", () => {
    const onFilesSelected = vi.fn()
    render(<DropZone onFilesSelected={onFilesSelected} disabled />)
    const zone = screen.getByTestId("dropzone")
    const input = document.querySelector('input[type="file"]') as HTMLInputElement

    expect(input.disabled).toBe(true)

    const file = createFile("test.csv", 100, "text/csv")
    fireEvent.drop(zone, { dataTransfer: { files: [file] } })
    expect(onFilesSelected).not.toHaveBeenCalled()
  })
})
