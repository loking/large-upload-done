export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </head>
      <body style={{ fontFamily: "system-ui, -apple-system, Segoe UI, Roboto, sans-serif", margin: 0 }}>
        <div style={{ maxWidth: 1100, margin: "0 auto", padding: 24 }}>
          <header style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 18 }}>
            <div style={{ fontWeight: 700 }}>Large Upload Take-home</div>
            <div style={{ color: "#666" }}>Chunked uploads + data preview</div>
          </header>
          {children}
        </div>
      </body>
    </html>
  )
}

