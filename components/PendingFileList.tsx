"use client"

import { useEffect, useState } from "react"
import { validateCsvFile, isUploadable } from "@/lib/csv-validator"

interface PendingFileListProps {
  files: File[]
  onRemove: (index: number) => void
  onStart: () => void
  hidden?: boolean
}

type ValidationState = "pending" | "valid" | "invalid"

interface FileValidation {
  state: ValidationState
  error?: string
  warnings?: string[]
}

function formatBytes(n: number) {
  const units = ["B", "KB", "MB", "GB"]
  let i = 0
  let x = n
  while (x >= 1024 && i < units.length - 1) {
    x /= 1024
    i++
  }
  return `${x.toFixed(i === 0 ? 0 : 1)} ${units[i]}`
}

export default function PendingFileList({ files, onRemove, onStart, hidden }: PendingFileListProps) {
  const [validations, setValidations] = useState<Map<File, FileValidation>>(new Map())

  useEffect(() => {
    for (const file of files) {
      if (validations.has(file)) continue
      setValidations((prev) => new Map(prev).set(file, { state: "pending" }))
      validateCsvFile(file).then((result) => {
        setValidations((prev) => {
          const next = new Map(prev)
          if (result.valid) {
            next.set(file, { state: "valid", warnings: result.warnings })
          } else {
            next.set(file, { state: "invalid", error: result.error })
          }
          return next
        })
      })
    }
  }, [files, validations])

  if (hidden || files.length === 0) return null

  const hasUploadableFile = files.some((f) => {
    const v = validations.get(f)
    return v?.state === "valid" && isUploadable({ valid: true, warnings: v.warnings })
  })
  const allValidated = files.every((f) => {
    const v = validations.get(f)
    return v && v.state !== "pending"
  })

  return (
    <div data-testid="pending-file-list">
      <div style={{ marginTop: 12, display: "flex", flexDirection: "column", gap: 6 }}>
        {files.map((f, i) => {
          const v = validations.get(f)
          const isInvalid = v?.state === "invalid"
          const hasWarnings = v?.state === "valid" && v.warnings && v.warnings.length > 0
          return (
            <div
              key={`${f.name}-${i}`}
              data-testid={`file-status-${i}`}
              data-valid={v?.state === "valid" ? "true" : v?.state === "invalid" ? "false" : "pending"}
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "8px 12px",
                background: isInvalid ? "#fef2f2" : hasWarnings ? "#fffbeb" : "#f9fafb",
                border: isInvalid ? "1px solid #fecaca" : hasWarnings ? "1px solid #fde68a" : "1px solid transparent",
                borderRadius: 8,
                fontSize: 14,
              }}
            >
              <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                <span style={{ color: isInvalid ? "#991b1b" : "#333" }}>
                  {f.name} <span style={{ color: "#888" }}>({formatBytes(f.size)})</span>
                  {isInvalid && (
                    <span style={{ marginLeft: 8, color: "#dc2626", fontSize: 12, fontWeight: 600 }}>
                      Invalid
                    </span>
                  )}
                </span>
                {isInvalid && v.error && (
                  <span style={{ color: "#b91c1c", fontSize: 12 }}>{v.error}</span>
                )}
                {hasWarnings && v.warnings!.map((w, wi) => (
                  <span
                    key={wi}
                    data-testid={`file-warning-${i}`}
                    style={{ color: "#92400e", fontSize: 12, display: "flex", alignItems: "center", gap: 4 }}
                  >
                    <span style={{ fontSize: 14 }}>&#9888;</span>
                    {w === "no-header" ? "No header row detected" : w === "no-data" ? "No data rows — will be skipped" : w === "duplicate-columns" ? "Duplicate column names detected" : w === "mixed-types" ? "Mixed data types detected in columns" : w}
                  </span>
                ))}
              </div>
              <button
                onClick={() => onRemove(i)}
                style={{
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  color: "#999",
                  fontSize: 16,
                  padding: "0 4px",
                  lineHeight: 1,
                  flexShrink: 0,
                }}
                aria-label={`Remove ${f.name}`}
              >
                &times;
              </button>
            </div>
          )
        })}
      </div>
      <button
        onClick={() => { if (hasUploadableFile) onStart() }}
        disabled={!hasUploadableFile || !allValidated}
        style={{
          marginTop: 12,
          padding: "10px 20px",
          borderRadius: 8,
          background: hasUploadableFile && allValidated ? "#111" : "#999",
          color: "#fff",
          border: "none",
          cursor: hasUploadableFile && allValidated ? "pointer" : "not-allowed",
          fontWeight: 500,
          opacity: hasUploadableFile && allValidated ? 1 : 0.6,
        }}
      >
        Start upload
      </button>
    </div>
  )
}

export function useFileValidations(files: File[]) {
  const [validations, setValidations] = useState<Map<File, FileValidation>>(new Map())

  useEffect(() => {
    for (const file of files) {
      if (validations.has(file)) continue
      setValidations((prev) => new Map(prev).set(file, { state: "pending" }))
      validateCsvFile(file).then((result) => {
        setValidations((prev) => {
          const next = new Map(prev)
          if (result.valid) {
            next.set(file, { state: "valid", warnings: result.warnings })
          } else {
            next.set(file, { state: "invalid", error: result.error })
          }
          return next
        })
      })
    }
  }, [files, validations])

  return validations
}
