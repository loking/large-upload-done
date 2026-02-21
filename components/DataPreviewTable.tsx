"use client"

import { useEffect, useState } from "react"
import type { PreviewResponse } from "@/lib/types"
import { analyzeColumns } from "@/lib/csv-analyzer"
import ColumnStatsPanel from "./ColumnStatsPanel"

interface DataPreviewTableProps {
  sessionId: string
}

export default function DataPreviewTable({ sessionId }: DataPreviewTableProps) {
  const [data, setData] = useState<PreviewResponse | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setError(null)
    setData(null)

    ;(async () => {
      const res = await fetch(`/api/upload/finalize?sessionId=${encodeURIComponent(sessionId)}`, {
        method: "GET",
      })
      if (!res.ok) {
        setError(`Failed to load preview (${res.status})`)
        return
      }
      const json = (await res.json()) as PreviewResponse
      setData(json)
    })()
  }, [sessionId])

  if (error) return <div style={{ color: "#b00020", padding: 12 }}>{error}</div>
  if (!data) {
    return (
      <div style={{ border: "1px solid #e5e5e5", borderRadius: 12, padding: 20, textAlign: "center", color: "#666" }}>
        Loading preview...
      </div>
    )
  }

  const { columns, rows } = data.preview
  const columnStats = analyzeColumns(columns, rows)

  return (
    <div style={{ display: "grid", gap: 14 }}>
      <ColumnStatsPanel stats={columnStats} totalRows={rows.length} />

      <div style={{ border: "1px solid #e5e5e5", borderRadius: 12, padding: 12 }}>
        <div style={{ fontWeight: 650, marginBottom: 8 }}>Row Preview</div>

        <div
          style={{
            overflowX: "auto",
            borderRadius: 8,
            border: "1px solid #eee",
            maxHeight: 400,
            overflowY: "auto",
          }}
        >
          <table style={{ borderCollapse: "collapse", fontSize: 12, minWidth: "100%" }}>
            <thead>
              <tr>
                <th
                  style={{
                    textAlign: "right",
                    padding: "8px 12px 8px 8px",
                    borderBottom: "2px solid #eee",
                    borderRight: "1px solid #eee",
                    color: "#999",
                    fontSize: 11,
                    position: "sticky",
                    top: 0,
                    left: 0,
                    background: "#fafafa",
                    zIndex: 2,
                  }}
                >
                  #
                </th>
                {columns.map((c) => (
                  <th
                    key={c}
                    style={{
                      textAlign: "left",
                      padding: "8px 12px",
                      borderBottom: "2px solid #eee",
                      whiteSpace: "nowrap",
                      position: "sticky",
                      top: 0,
                      background: "#fafafa",
                      zIndex: 1,
                      maxWidth: 200,
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                    }}
                  >
                    {c}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.slice(0, 50).map((r, idx) => (
                <tr key={idx} style={{ background: idx % 2 === 0 ? "#fff" : "#fafafa" }}>
                  <td
                    style={{
                      textAlign: "right",
                      padding: "6px 12px 6px 8px",
                      borderBottom: "1px solid #f3f3f3",
                      borderRight: "1px solid #eee",
                      color: "#bbb",
                      fontSize: 11,
                      position: "sticky",
                      left: 0,
                      background: idx % 2 === 0 ? "#fff" : "#fafafa",
                      zIndex: 1,
                    }}
                  >
                    {idx + 1}
                  </td>
                  {columns.map((c) => (
                    <td
                      key={c}
                      style={{
                        padding: "6px 12px",
                        borderBottom: "1px solid #f3f3f3",
                        whiteSpace: "nowrap",
                        maxWidth: 200,
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                      }}
                    >
                      {String(r[c] ?? "")}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div style={{ marginTop: 8, fontSize: 12, color: "#666" }}>
          Showing {Math.min(rows.length, 50)} of {rows.length} preview rows.
          {columns.length > 10 && " Scroll horizontally to see all columns."}
        </div>
      </div>
    </div>
  )
}
