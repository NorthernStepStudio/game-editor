export function SidebarLayout() {
  const files = ["core/src/ai.ts", "server/src/server.ts", "server/src/index.ts", "web/main.js", "web/styles.css"];
  const msgs = [
    { role: "user", text: "What are the key files?" },
    { role: "ai", text: "core/ holds the AI runtime, server/ exposes /ask and /health, web/ serves the frontend UI." },
  ];

  return (
    <div style={{
      minHeight: "100vh",
      background: "#0a0a0c",
      display: "flex",
      fontFamily: "-apple-system, BlinkMacSystemFont, 'Inter', sans-serif",
      fontSize: "13px",
      color: "#d4d4d8",
    }}>
      {/* Sidebar */}
      <div style={{
        width: "200px",
        flexShrink: 0,
        borderRight: "1px solid rgba(255,255,255,0.06)",
        background: "rgba(255,255,255,0.02)",
        display: "flex",
        flexDirection: "column",
      }}>
        {/* Brand */}
        <div style={{ padding: "14px 14px 10px", borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "7px" }}>
            <svg width="16" height="16" viewBox="0 0 20 20" fill="none">
              <path d="M3 16 10 3l7 13H3Z" stroke="#0078d4" strokeWidth="1.6" strokeLinejoin="round"/>
            </svg>
            <span style={{ fontSize: "13px", fontWeight: 700, color: "#e4e4e7" }}>Matterhorn</span>
          </div>
          <div style={{ fontSize: "10px", color: "#52525b", marginTop: "2px", paddingLeft: "23px" }}>Northern Step Studio</div>
        </div>

        {/* Agents */}
        <div style={{ padding: "10px 8px 0" }}>
          <div style={{ fontSize: "9px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: "#52525b", padding: "0 6px 6px" }}>Agents</div>
          {[
            { label: "General", active: true },
            { label: "Stack Expert", active: false },
            { label: "Architect", active: false },
            { label: "Workspace Ops", active: false },
          ].map(a => (
            <div key={a.label} style={{
              padding: "6px 8px",
              borderRadius: "6px",
              background: a.active ? "rgba(0,120,212,0.12)" : "none",
              color: a.active ? "#60a5fa" : "#71717a",
              fontSize: "12px",
              fontWeight: a.active ? 600 : 400,
              cursor: "pointer",
              marginBottom: "1px",
            }}>{a.label}</div>
          ))}
        </div>

        {/* Files */}
        <div style={{ padding: "12px 8px 0" }}>
          <div style={{ fontSize: "9px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: "#52525b", padding: "0 6px 6px" }}>Workspace</div>
          {files.map(f => (
            <div key={f} style={{
              padding: "5px 8px",
              borderRadius: "4px",
              color: "#71717a",
              fontSize: "11px",
              fontFamily: "'Cascadia Code', 'Fira Code', monospace",
              cursor: "pointer",
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}>{f}</div>
          ))}
        </div>

        <div style={{ flex: 1 }} />

        {/* Status */}
        <div style={{ padding: "12px 14px", borderTop: "1px solid rgba(255,255,255,0.05)", display: "flex", alignItems: "center", gap: "6px" }}>
          <div style={{ width: "6px", height: "6px", borderRadius: "50%", background: "#22c55e", boxShadow: "0 0 5px rgba(34,197,94,0.6)" }} />
          <span style={{ fontSize: "11px", color: "#52525b" }}>Connected · Mock</span>
        </div>
      </div>

      {/* Main panel */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0 }}>
        {/* Toolbar */}
        <div style={{ height: "40px", borderBottom: "1px solid rgba(255,255,255,0.05)", display: "flex", alignItems: "center", padding: "0 14px", gap: "8px" }}>
          <span style={{ fontSize: "12px", fontWeight: 600, color: "#e4e4e7" }}>General</span>
          <span style={{ color: "rgba(255,255,255,0.1)", fontSize: "14px" }}>·</span>
          <span style={{ fontSize: "11px", color: "#52525b" }}>Chat</span>
          <div style={{ flex: 1 }} />
          <div style={{
            background: "rgba(255,255,255,0.04)",
            border: "1px solid rgba(255,255,255,0.07)",
            borderRadius: "6px",
            padding: "4px 10px",
            fontSize: "11px",
            color: "#71717a",
            cursor: "pointer",
            display: "flex", alignItems: "center", gap: "4px",
          }}>
            <svg width="11" height="11" viewBox="0 0 16 16" fill="none">
              <circle cx="6.5" cy="6.5" r="4" stroke="currentColor" strokeWidth="1.3"/>
              <path d="M10 10 14 14" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
            </svg>
            Search
          </div>
        </div>

        {/* Messages */}
        <div style={{ flex: 1, overflow: "auto", padding: "16px 16px 8px", display: "flex", flexDirection: "column", gap: "10px" }}>
          {msgs.map((m, i) => (
            <div key={i} style={{ display: "flex", justifyContent: m.role === "user" ? "flex-end" : "flex-start" }}>
              <div style={{
                maxWidth: "78%",
                padding: "9px 12px",
                borderRadius: "10px",
                ...(m.role === "user" ? {
                  background: "#0078d4",
                  color: "#fff",
                  borderBottomRightRadius: "3px",
                  boxShadow: "0 2px 10px rgba(0,120,212,0.3)",
                } : {
                  background: "rgba(255,255,255,0.04)",
                  border: "1px solid rgba(255,255,255,0.07)",
                  color: "#d4d4d8",
                  borderBottomLeftRadius: "3px",
                }),
                fontSize: "12px",
                lineHeight: 1.55,
              }}>{m.text}</div>
            </div>
          ))}
        </div>

        {/* Composer */}
        <div style={{ padding: "8px 12px 12px" }}>
          <div style={{
            display: "flex",
            alignItems: "center",
            gap: "8px",
            background: "rgba(255,255,255,0.04)",
            border: "1px solid rgba(255,255,255,0.08)",
            borderRadius: "10px",
            padding: "8px 8px 8px 12px",
          }}>
            <span style={{ flex: 1, fontSize: "12px", color: "#3f3f46" }}>Ask Matterhorn…</span>
            <div style={{
              width: "28px", height: "28px",
              background: "#0078d4",
              borderRadius: "7px",
              display: "flex", alignItems: "center", justifyContent: "center",
            }}>
              <svg width="12" height="12" viewBox="0 0 16 16" fill="none">
                <path d="M2 8 14 2l-4 12-2-5-6-1Z" fill="#fff"/>
              </svg>
            </div>
          </div>
          <div style={{ display: "flex", justifyContent: "flex-end", paddingTop: "4px" }}>
            <span style={{ fontSize: "10px", color: "#3f3f46" }}>✦ Build Foundation</span>
          </div>
        </div>
      </div>
    </div>
  );
}
