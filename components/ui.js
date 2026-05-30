"use client";
import { useState, useEffect, useRef } from "react";
import { buildFileTree } from "../lib/utils";

// ── Glass code block with copy + download ─────────────────────────
export function CodeBlock({ children, downloadName, lang = "" }) {
  const [copied, setCopied] = useState(false);
  return (
    <div style={{ position: "relative", marginBottom: 16 }}>
      <pre className="glass mono" style={{
        padding: "20px 56px 20px 20px", fontSize: 12.5, color: "#9fd4ff",
        overflowX: "auto", lineHeight: 1.8, borderRadius: 16, whiteSpace: "pre-wrap", wordBreak: "break-word",
      }}>{children}</pre>
      <div style={{ position: "absolute", top: 12, right: 12, display: "flex", gap: 6 }}>
        {downloadName && (
          <button
            onClick={() => {
              const b = new Blob([children], { type: "text/plain" });
              const a = document.createElement("a");
              a.href = URL.createObjectURL(b); a.download = downloadName; a.click();
            }}
            className="mono"
            style={{ padding: "5px 10px", background: "rgba(77,159,255,0.18)", border: "1px solid rgba(77,159,255,0.35)", borderRadius: 7, color: "#7dc4ff", fontSize: 11, cursor: "pointer" }}>
            ↓ save
          </button>
        )}
        <button
          onClick={() => { navigator.clipboard?.writeText(children); setCopied(true); setTimeout(() => setCopied(false), 1500); }}
          className="mono"
          style={{ padding: "5px 10px", background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.14)", borderRadius: 7, color: "#b8c2e0", fontSize: 11, cursor: "pointer" }}>
          {copied ? "✓ copied" : "copy"}
        </button>
      </div>
    </div>
  );
}

// ── Collapsible file tree node ────────────────────────────────────
function TreeNode({ name, node, depth = 0 }) {
  const [open, setOpen] = useState(depth < 2);
  const isFile = node === null;
  if (isFile) return (
    <div className="mono" style={{ paddingLeft: depth * 16, display: "flex", alignItems: "center", gap: 7, padding: `3px 0 3px ${depth * 16}px`, color: "#6b7699", fontSize: 11.5 }}>
      <span style={{ opacity: 0.4 }}>·</span>{name}
    </div>
  );
  const children = Object.entries(node);
  return (
    <div>
      <div onClick={() => setOpen(o => !o)} className="mono"
        style={{ paddingLeft: depth * 16, display: "flex", alignItems: "center", gap: 7, padding: `3px 0 3px ${depth * 16}px`, color: "#7dc4ff", fontSize: 11.5, cursor: "pointer" }}>
        <span style={{ opacity: 0.6, transition: "transform 0.2s", transform: open ? "rotate(90deg)" : "none", display: "inline-block" }}>▸</span>{name}/
      </div>
      {open && children.map(([k, v]) => <TreeNode key={k} name={k} node={v} depth={depth + 1} />)}
    </div>
  );
}

export function FileTreeView({ paths }) {
  const tree = buildFileTree(paths);
  return (
    <div className="glass" style={{ padding: "16px 18px", maxHeight: 280, overflowY: "auto", borderRadius: 14 }}>
      {Object.entries(tree).map(([k, v]) => <TreeNode key={k} name={k} node={v} depth={0} />)}
    </div>
  );
}

// ── Mermaid diagram renderer ──────────────────────────────────────
export function Mermaid({ code }) {
  const ref = useRef(null);
  const [err, setErr] = useState(false);
  useEffect(() => {
    let active = true;
    import("mermaid").then(({ default: mermaid }) => {
      if (!active) return;
      mermaid.initialize({
        startOnLoad: false, theme: "dark", securityLevel: "loose",
        themeVariables: {
          primaryColor: "#0e1a33", primaryTextColor: "#dbe6ff", primaryBorderColor: "#4d9fff",
          lineColor: "#4d6080", fontFamily: "JetBrains Mono, monospace", fontSize: "13px",
        },
      });
      const id = "mmd-" + Math.random().toString(36).slice(2);
      mermaid.render(id, code).then(({ svg }) => {
        if (ref.current && active) ref.current.innerHTML = svg;
      }).catch(() => active && setErr(true));
    }).catch(() => active && setErr(true));
    return () => { active = false; };
  }, [code]);

  if (err) return <CodeBlock downloadName="architecture.mmd">{code}</CodeBlock>;
  return (
    <div className="glass" style={{ padding: 24, borderRadius: 18, overflowX: "auto", display: "flex", justifyContent: "center", marginBottom: 16 }}>
      <div ref={ref} style={{ minHeight: 200 }} />
    </div>
  );
}

// ── Bob progress tracker (analyzing screen) ───────────────────────
export function BobProgress({ tasks, currentIdx, progress, statusMsg }) {
  return (
    <div style={{ width: "100%", maxWidth: 500 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 30 }}>
        <div style={{ width: 46, height: 46, borderRadius: "50%", background: "linear-gradient(135deg,#4d9fff,#38e8d4)", display: "flex", alignItems: "center", justifyContent: "center", animation: "spin 1.8s linear infinite", boxShadow: "0 0 28px rgba(77,159,255,0.5)", flexShrink: 0 }}>
          <span style={{ fontSize: 20, color: "#04111f" }}>⚡</span>
        </div>
        <div>
          <div className="display" style={{ color: "#eef2ff", fontWeight: 600, fontSize: 16 }}>HAL is analyzing</div>
          <div className="mono" style={{ color: "#6b7699", fontSize: 12, marginTop: 2 }}>{statusMsg}</div>
        </div>
      </div>

      <div style={{ background: "rgba(255,255,255,0.06)", borderRadius: 8, height: 5, overflow: "hidden", marginBottom: 8 }}>
        <div style={{ height: "100%", width: `${progress}%`, background: "linear-gradient(90deg,#4d9fff,#38e8d4)", borderRadius: 8, transition: "width 0.2s ease", boxShadow: "0 0 12px rgba(77,159,255,0.6)" }} />
      </div>
      <div className="mono" style={{ textAlign: "right", marginBottom: 26, fontSize: 12, color: "#4d9fff" }}>{Math.round(progress)}%</div>

      <div className="glass" style={{ padding: "18px 22px", borderRadius: 18 }}>
        {tasks.map((t, i) => {
          const done = i < currentIdx, active = i === currentIdx;
          return (
            <div key={t.id} style={{ display: "flex", alignItems: "center", gap: 13, padding: "10px 0", borderBottom: i < tasks.length - 1 ? "1px solid rgba(255,255,255,0.06)" : "none", opacity: done || active ? 1 : 0.32, transition: "opacity 0.4s" }}>
              <span style={{ width: 24, height: 24, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, flexShrink: 0, transition: "all 0.3s", color: done ? "#04111f" : "#7dc4ff", background: done ? "linear-gradient(135deg,#2ce8a8,#38e8d4)" : active ? "rgba(77,159,255,0.25)" : "rgba(255,255,255,0.06)", border: active ? "1px solid #4d9fff" : "1px solid transparent" }}>
                {done ? "✓" : t.icon}
              </span>
              <span className="mono" style={{ fontSize: 13, color: active ? "#7dc4ff" : "#dbe6ff" }}>{t.label}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
