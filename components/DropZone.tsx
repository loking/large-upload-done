"use client"

import { useRef, useState, useCallback } from "react"

interface DropZoneProps {
  onFilesSelected: (files: File[]) => void
  disabled?: boolean
}

export default function DropZone({ onFilesSelected, disabled }: DropZoneProps) {
  const [dragOver, setDragOver] = useState(false)
  const [hover, setHover] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const dragCounter = useRef(0)

  const handleDragEnter = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      e.stopPropagation()
      dragCounter.current++
      if (!disabled) setDragOver(true)
    },
    [disabled],
  )

  const handleDragOver = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      e.stopPropagation()
    },
    [],
  )

  const handleDragLeave = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      e.stopPropagation()
      dragCounter.current--
      if (dragCounter.current === 0) setDragOver(false)
    },
    [],
  )

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      e.stopPropagation()
      dragCounter.current = 0
      setDragOver(false)
      if (disabled) return
      const files = Array.from(e.dataTransfer.files)
      if (files.length > 0) onFilesSelected(files)
    },
    [disabled, onFilesSelected],
  )

  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = e.target.files ? Array.from(e.target.files) : []
      if (files.length > 0) onFilesSelected(files)
    },
    [onFilesSelected],
  )

  const handleClick = useCallback(() => {
    if (!disabled) inputRef.current?.click()
  }, [disabled])

  const active = dragOver || hover
  const borderColor = disabled ? "#e5e5e5" : active ? "#111" : "#d1d5db"
  const bg = disabled ? "transparent" : dragOver ? "#f0f0f0" : hover ? "#fafafa" : "transparent"

  return (
    <div
      data-testid="dropzone"
      data-dragover={dragOver ? "true" : "false"}
      onClick={handleClick}
      onMouseEnter={() => { if (!disabled) setHover(true) }}
      onMouseLeave={() => setHover(false)}
      onDragEnter={handleDragEnter}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      style={{
        border: `2px dashed ${borderColor}`,
        borderRadius: 12,
        padding: "40px 20px",
        textAlign: "center",
        cursor: disabled ? "default" : "pointer",
        background: bg,
        transition: "all 0.15s ease",
        opacity: disabled ? 0.5 : 1,
      }}
    >
      <input
        ref={inputRef}
        type="file"
        accept=".csv,text/csv"
        multiple
        disabled={disabled}
        onChange={handleInputChange}
        style={{ display: "none" }}
      />
      <div style={{ pointerEvents: "none" }}>
        <div style={{ fontSize: 36, marginBottom: 8, color: active ? "#111" : "#9ca3af" }}>
          {dragOver ? "\u2193" : "\u2191"}
        </div>
        <div style={{ fontWeight: 600, fontSize: 15, color: active ? "#111" : "#333", marginBottom: 4 }}>
          Drag & drop CSV files here
        </div>
        <div style={{ fontSize: 13, color: active ? "#555" : "#888" }}>
          or click to browse
        </div>
      </div>
    </div>
  )
}
