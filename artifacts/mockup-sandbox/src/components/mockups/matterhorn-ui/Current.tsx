export function Current() {
  return (
    <div style={{
      minHeight: "100vh",
      background: "#0d0d0f",
      backgroundImage: "radial-gradient(ellipse 80% 50% at 50% -20%, rgba(0,120,212,0.18) 0%, transparent 60%)",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      fontFamily: "-apple-system, BlinkMacSystemFont, 'Inter', 'Segoe UI', sans-serif",
      padding: "16px",
    }}>
      <div style={{
        width: "100%",
        maxWidth: "380px",
        display: "flex",
        flexDirection: "column",
        gap: "8px",
      }}>
        {/* Header */}
        <div style={{
          background: "rgba(255,255,255,0.035)",
          border: "1px solid rgba(255,255,255,0.08)",
          borderRadius: "12px",
          backdropFilter: "blur(18px)",
          padding: "10px 14px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          boxShadow: "0 8px 32px rgba(0,0,0,0.4)",
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: "9px" }}>
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none" style={{ color: "#0078d4", filter: "drop-shadow(0 0 6px rgba(0,120,212,0.55))" }}>
              <path d="M3 16 10 3l7 13H3Z" stroke="#0078d4" strokeWidth="1.4" strokeLinejoin="round"/>
            </svg>
            <div>
              <div style={{ fontSize: "14px", fontWeight: 700, color: "#e2e2e6", letterSpacing: "-0.02em" }}>Matterhorn</div>
              <div style={{ fontSize: "10px", fontWeight: 500, textTransform: "uppercase", letterSpacing: "0.1em", color: "#7c7c86" }}>Northern Step Studio</div>
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
            <div style={{ width: "6px", height: "6px", borderRadius: "50%", background: "#22c55e", boxShadow: "0 0 6px rgba(34,197,94,0.7)" }} />
            <span style={{ fontSize: "11px", color: "#7c7c86" }}>Connected</span>
            <span style={{ fontSize: "10px", fontWeight: 700, padding: "2px 8px", borderRadius: "999px", background: "rgba(0,120,212,0.14)", border: "1px solid rgba(0,120,212,0.28)", color: "#60a5fa" }}>Mock</span>
          </div>
        </div>

        {/* Agent tabs */}
        <div style={{ display: "flex", gap: "4px", padding: "2px 0" }}>
          {["General", "Stack Expert", "Architect", "Workspace Ops"].map((tab, i) => (
            <button key={tab} style={{
              background: i === 0 ? "rgba(0,120,212,0.14)" : "none",
              border: `1px solid ${i === 0 ? "rgba(0,120,212,0.28)" : "transparent"}`,
              borderRadius: "8px",
              color: i === 0 ? "#60a5fa" : "#7c7c86",
              fontSize: "11px",
              fontWeight: 600,
              padding: "5px 10px",
              cursor: "pointer",
              whiteSpace: "nowrap",
              fontFamily: "inherit",
            }}>{tab}</button>
          ))}
        </div>

        {/* Empty state */}
        <div style={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: "10px",
          padding: "40px 20px",
          textAlign: "center",
        }}>
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" style={{ opacity: 0.2 }}>
            <path d="M4 19 12 4l8 15H4Z" stroke="#e2e2e6" strokeWidth="1.2" strokeLinejoin="round"/>
          </svg>
          <p style={{ fontSize: "12px", color: "#7c7c86", maxWidth: "200px", lineHeight: 1.6 }}>
            Ask Matterhorn anything about your workspace, code, or changes.
          </p>
        </div>

        {/* Chat bubbles */}
        <div style={{ display: "flex", flexDirection: "column", gap: "8px", padding: "4px 0" }}>
          <div style={{ display: "flex", justifyContent: "flex-end" }}>
            <div style={{
              background: "#0078d4",
              color: "#fff",
              borderRadius: "12px",
              borderBottomRightRadius: "4px",
              padding: "10px 13px",
              fontSize: "13px",
              maxWidth: "80%",
              boxShadow: "0 2px 12px rgba(0,120,212,0.35)",
            }}>What are the main files in this project?</div>
          </div>
          <div style={{ display: "flex", justifyContent: "flex-start" }}>
            <div style={{
              background: "rgba(255,255,255,0.05)",
              border: "1px solid rgba(255,255,255,0.08)",
              color: "#e2e2e6",
              borderRadius: "12px",
              borderBottomLeftRadius: "4px",
              padding: "10px 13px",
              fontSize: "13px",
              maxWidth: "80%",
              backdropFilter: "blur(12px)",
            }}>The workspace contains core/, server/, extension/, and bridges/. The server exposes /health and /ask endpoints on port 5000.</div>
          </div>
        </div>

        {/* Composer */}
        <div style={{ paddingBottom: "8px" }}>
          <div style={{
            display: "flex",
            alignItems: "center",
            gap: "8px",
            background: "rgba(255,255,255,0.04)",
            border: "1px solid rgba(255,255,255,0.08)",
            borderRadius: "18px",
            padding: "8px 8px 8px 14px",
            backdropFilter: "blur(18px)",
            boxShadow: "0 4px 24px rgba(0,0,0,0.4)",
          }}>
            <span style={{ flex: 1, fontSize: "13px", color: "#3e3e44" }}>Ask Matterhorn…</span>
            <div style={{
              width: "32px", height: "32px",
              background: "#0078d4",
              borderRadius: "10px",
              display: "flex", alignItems: "center", justifyContent: "center",
              boxShadow: "0 2px 8px rgba(0,120,212,0.45)",
            }}>
              <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
                <path d="M2 8 14 2l-4 12-2-5-6-1Z" fill="#fff"/>
              </svg>
            </div>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", padding: "5px 2px 0", fontSize: "10px", color: "#3e3e44" }}>
            <span>Enter to send · Shift+Enter for newline</span>
            <span>✦ Build Foundation</span>
          </div>
        </div>
      </div>
    </div>
  );
}
