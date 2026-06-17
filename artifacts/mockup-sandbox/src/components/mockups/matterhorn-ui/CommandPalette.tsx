import { useState } from "react";

export function CommandPalette() {
  const [focused, setFocused] = useState(true);

  const suggestions = [
    { icon: "✦", label: "Build Foundation", desc: "Overview of workspace structure" },
    { icon: "⌘", label: "Explain current file", desc: "Summarize the active file" },
    { icon: "⚡", label: "Find related code", desc: "Locate similar patterns" },
    { icon: "◈", label: "Review recent changes", desc: "Diff since last commit" },
  ];

  const history = [
    { role: "user" as const, text: "What does server.ts do?" },
    { role: "ai" as const, text: "server.ts sets up the HTTP server, serves static files from web/, and exposes /health and /ask endpoints." },
    { role: "user" as const, text: "How do I add a new endpoint?" },
    { role: "ai" as const, text: "Add a new route handler inside the request listener in server.ts. Match on req.url and req.method, then write your response." },
  ];

  return (
    <div style={{
      minHeight: "100vh",
      background: "#08080a",
      backgroundImage: "radial-gradient(ellipse 100% 60% at 50% 0%, rgba(0,100,180,0.14) 0%, transparent 55%)",
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      fontFamily: "-apple-system, BlinkMacSystemFont, 'Inter', sans-serif",
      padding: "0",
    }}>
      {/* Ambient top bar */}
      <div style={{
        width: "100%",
        height: "36px",
        borderBottom: "1px solid rgba(255,255,255,0.04)",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "0 16px",
        background: "rgba(255,255,255,0.015)",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
          <svg width="14" height="14" viewBox="0 0 20 20" fill="none">
            <path d="M3 16 10 3l7 13H3Z" stroke="#0078d4" strokeWidth="1.5" strokeLinejoin="round"/>
          </svg>
          <span style={{ fontSize: "12px", fontWeight: 700, color: "#52525b", letterSpacing: "-0.01em" }}>Matterhorn</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
          <div style={{ width: "5px", height: "5px", borderRadius: "50%", background: "#22c55e", boxShadow: "0 0 5px rgba(34,197,94,0.6)" }} />
          <span style={{ fontSize: "10px", color: "#3f3f46" }}>Mock · Connected</span>
        </div>
      </div>

      {/* Command input centered */}
      <div style={{ width: "100%", maxWidth: "520px", padding: "28px 16px 0" }}>
        <div style={{
          background: "rgba(255,255,255,0.04)",
          border: "1px solid rgba(0,120,212,0.35)",
          borderRadius: "14px",
          boxShadow: "0 0 0 4px rgba(0,120,212,0.08), 0 20px 60px rgba(0,0,0,0.6)",
          overflow: "hidden",
        }}>
          {/* Input row */}
          <div style={{ display: "flex", alignItems: "center", gap: "10px", padding: "12px 14px", borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none" style={{ color: "#0078d4", flexShrink: 0 }}>
              <circle cx="6.5" cy="6.5" r="4" stroke="#0078d4" strokeWidth="1.3"/>
              <path d="M10 10 14 14" stroke="#0078d4" strokeWidth="1.3" strokeLinecap="round"/>
            </svg>
            <span style={{ flex: 1, fontSize: "13px", color: "#71717a" }}>Ask Matterhorn anything…</span>
            <div style={{ display: "flex", gap: "3px" }}>
              {["General", "Stack", "Arch"].map((t, i) => (
                <span key={t} style={{
                  fontSize: "9px", fontWeight: 700,
                  padding: "2px 6px",
                  borderRadius: "4px",
                  background: i === 0 ? "rgba(0,120,212,0.2)" : "rgba(255,255,255,0.04)",
                  border: `1px solid ${i === 0 ? "rgba(0,120,212,0.4)" : "rgba(255,255,255,0.07)"}`,
                  color: i === 0 ? "#60a5fa" : "#52525b",
                  cursor: "pointer",
                }}>{t}</span>
              ))}
            </div>
          </div>

          {/* Quick suggestions */}
          <div style={{ padding: "6px" }}>
            <div style={{ fontSize: "9px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: "#3f3f46", padding: "4px 8px 6px" }}>Quick Actions</div>
            {suggestions.map((s, i) => (
              <div key={i} style={{
                display: "flex",
                alignItems: "center",
                gap: "10px",
                padding: "7px 8px",
                borderRadius: "8px",
                cursor: "pointer",
                background: i === 0 ? "rgba(0,120,212,0.1)" : "none",
                border: `1px solid ${i === 0 ? "rgba(0,120,212,0.2)" : "transparent"}`,
                marginBottom: "2px",
              }}>
                <span style={{ fontSize: "13px", width: "18px", textAlign: "center", color: i === 0 ? "#60a5fa" : "#52525b" }}>{s.icon}</span>
                <div>
                  <div style={{ fontSize: "12px", fontWeight: 600, color: i === 0 ? "#e4e4e7" : "#a1a1aa" }}>{s.label}</div>
                  <div style={{ fontSize: "10px", color: "#52525b" }}>{s.desc}</div>
                </div>
                {i === 0 && <div style={{ marginLeft: "auto", fontSize: "9px", color: "#3f3f46", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: "4px", padding: "2px 5px" }}>↵</div>}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Recent conversation */}
      <div style={{ width: "100%", maxWidth: "520px", padding: "16px 16px 0", flex: 1, overflow: "auto" }}>
        <div style={{ fontSize: "9px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: "#3f3f46", marginBottom: "10px", paddingLeft: "2px" }}>Recent</div>
        <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
          {history.map((m, i) => (
            <div key={i} style={{ display: "flex", justifyContent: m.role === "user" ? "flex-end" : "flex-start" }}>
              <div style={{
                maxWidth: "86%",
                padding: "9px 12px",
                borderRadius: "10px",
                fontSize: "12px",
                lineHeight: 1.55,
                ...(m.role === "user" ? {
                  background: "#0078d4",
                  color: "#fff",
                  borderBottomRightRadius: "3px",
                  boxShadow: "0 2px 10px rgba(0,120,212,0.3)",
                } : {
                  background: "rgba(255,255,255,0.04)",
                  border: "1px solid rgba(255,255,255,0.07)",
                  color: "#a1a1aa",
                  borderBottomLeftRadius: "3px",
                }),
              }}>{m.text}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Bottom hint */}
      <div style={{ padding: "12px 16px", fontSize: "10px", color: "#27272a", display: "flex", gap: "12px" }}>
        <span>↑↓ navigate</span>
        <span>↵ confirm</span>
        <span>⌘K open</span>
        <span>Esc close</span>
      </div>
    </div>
  );
}
