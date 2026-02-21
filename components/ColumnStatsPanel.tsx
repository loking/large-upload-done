"use client"

import type { ColumnStats } from "@/lib/csv-analyzer"

const TYPE_COLORS: Record<string, string> = {
  number: "#2563eb",
  boolean: "#9333ea",
  date: "#0891b2",
  string: "#64748b",
  unknown: "#94a3b8",
}

export default function ColumnStatsPanel({ stats, totalRows }: { stats: ColumnStats[]; totalRows: number }) {
  return (
    <div style={{ border: "1px solid #e5e5e5", borderRadius: 12, padding: 16 }}>
      <div style={{ fontWeight: 650, marginBottom: 4 }}>
        Data Summary
      </div>
      <div style={{ fontSize: 13, color: "#666", marginBottom: 12 }}>
        {stats.length} columns &middot; {totalRows.toLocaleString()} rows
      </div>

      <div style={{ display: "grid", gap: 6 }}>
        {stats.map((col) => (
          <div
            key={col.name}
            style={{
              display: "grid",
              gridTemplateColumns: "minmax(120px, 1fr) 80px 70px 1fr",
              gap: 12,
              alignItems: "center",
              fontSize: 13,
              padding: "6px 8px",
              borderRadius: 6,
              background: col.warnings.length > 0 ? "#fffbeb" : "transparent",
            }}
          >
            <div style={{ fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {col.name}
            </div>
            <span
              style={{
                padding: "2px 8px",
                borderRadius: 999,
                background: `${TYPE_COLORS[col.inferredType] ?? TYPE_COLORS.unknown}15`,
                color: TYPE_COLORS[col.inferredType] ?? TYPE_COLORS.unknown,
                fontSize: 11,
                fontWeight: 600,
                textAlign: "center",
              }}
            >
              {col.inferredType}
            </span>
            <span style={{ color: col.emptyCount > 0 ? "#d97706" : "#666", fontSize: 12 }}>
              {col.totalCount > 0 ? `${Math.round((col.emptyCount / col.totalCount) * 100)}% empty` : "\u2014"}
            </span>
            <div style={{ fontSize: 12, color: "#888", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {col.numericRange
                ? `range: ${col.numericRange.min} \u2013 ${col.numericRange.max}`
                : col.sampleValues.slice(0, 4).join(", ")}
            </div>
          </div>
        ))}
      </div>

      {stats.some((c) => c.warnings.length > 0) && (
        <div style={{ marginTop: 12, padding: "8px 12px", background: "#fffbeb", borderRadius: 8, fontSize: 13 }}>
          <div style={{ fontWeight: 600, color: "#92400e", marginBottom: 4 }}>Issues found:</div>
          {stats
            .filter((c) => c.warnings.length > 0)
            .map((c) => (
              <div key={c.name} style={{ color: "#78350f" }}>
                <b>{c.name}</b>: {c.warnings.join("; ")}
              </div>
            ))}
        </div>
      )}
    </div>
  )
}
