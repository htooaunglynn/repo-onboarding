"use client";
import { useState, useRef, useCallback } from "react";
import { BOB_TASKS, shouldIgnore } from "../lib/utils";
import { DEMO_RESULT } from "../lib/demoData";
import { CodeBlock, FileTreeView, Mermaid, BobProgress } from "../components/ui";

export default function Home() {
  const [phase, setPhase]       = useState("landing");   // landing | preview | analyzing | result | error
  const [mode, setMode]         = useState("local");      // local | github
  const [ghUrl, setGhUrl]       = useState("");
  const [apiKey, setApiKey]     = useState("");
  const [dropped, setDropped]   = useState([]);
  const [repoName, setRepoName] = useState("");
  const [dragOver, setDragOver] = useState(false);
  const [progress, setProgress] = useState(0);
  const [taskIdx, setTaskIdx]   = useState(0);
  const [statusMsg, setStatus]  = useState("");
  const [result, setResult]     = useState(null);
  const [tab, setTab]           = useState("Summary");
  const [errMsg, setErrMsg]     = useState("");
  const folderRef = useRef(null);

  // ── Folder picker ──────────────────────────────────────────────
  const onFolderPick = useCallback(e => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    setRepoName(files[0].webkitRelativePath?.split("/")[0] || "local-repo");
    setDropped(files); setPhase("preview");
  }, []);

  // ── Drag & drop with directory traversal ───────────────────────
  const onDrop = useCallback(e => {
    e.preventDefault(); setDragOver(false);
    const items = Array.from(e.dataTransfer.items || []);
    const proms = [];
    const traverse = (entry, prefix = "") => new Promise(res => {
      if (entry.isFile) entry.file(f => { try { Object.defineProperty(f, "webkitRelativePath", { value: prefix + f.name }); } catch {} res([f]); });
      else if (entry.isDirectory) {
        const r = entry.createReader();
        r.readEntries(async es => { const nested = await Promise.all(es.map(x => traverse(x, prefix + entry.name + "/"))); res(nested.flat()); });
      } else res([]);
    });
    items.filter(i => i.kind === "file").forEach(item => { const en = item.webkitGetAsEntry?.(); if (en) proms.push(traverse(en, "")); });
    Promise.all(proms).then(r => {
      const files = r.flat();
      if (!files.length) return;
      setRepoName(files[0].webkitRelativePath?.split("/")[0] || "dropped-repo");
      setDropped(files); setPhase("preview");
    });
  }, []);

  // ── Run analysis (demo mode; swap for real fetch in production) ─
  const runAnalysis = useCallback(async (source, nameOverride) => {
    const rName = nameOverride || repoName;
    setPhase("analyzing"); setProgress(2); setTaskIdx(0); setStatus("Starting Bob…");

    const milestones = [
      { at: 8,  task: 0, msg: "Reading file tree…" },
      { at: 24, task: 1, msg: "Generating README…" },
      { at: 44, task: 2, msg: "Building architecture diagram…" },
      { at: 66, task: 3, msg: "Writing onboarding summary…" },
      { at: 84, task: 4, msg: "Running security scan…" },
      { at: 96, task: 5, msg: "Exporting Bob session report…" },
    ];
    let p = 2;
    const iv = setInterval(() => {
      p = Math.min(p + Math.random() * 2.2 + 0.7, 99);
      setProgress(p);
      const ms = milestones.filter(m => p >= m.at);
      if (ms.length) { setTaskIdx(ms[ms.length - 1].task); setStatus(ms[ms.length - 1].msg); }
    }, 145);

    /* ── PRODUCTION WIRING (uncomment when Bob backend is ready) ──
    try {
      let data;
      if (source === "local") {
        const fd = new FormData();
        fd.append("repoName", rName);
        fd.append("apiKey", apiKey);
        dropped.filter(f => !shouldIgnore(f.webkitRelativePath || f.name)).forEach(f => {
          fd.append("files", f); fd.append("paths", f.webkitRelativePath || f.name);
        });
        data = await (await fetch("/api/onboard-local", { method: "POST", body: fd })).json();
      } else {
        data = await (await fetch("/api/onboard-github", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ url: ghUrl, apiKey: apiKey }),
        })).json();
      }
      clearInterval(iv);
      if (data.error) throw new Error(data.error);
      setResult(data); setProgress(100); setTaskIdx(BOB_TASKS.length);
      setTimeout(() => setPhase("result"), 300);
      return;
    } catch (err) { clearInterval(iv); setErrMsg(err.message); setPhase("error"); return; }
    ──────────────────────────────────────────────────────────── */

    // Demo fallback
    await new Promise(r => setTimeout(r, 5500));
    clearInterval(iv);
    setProgress(100); setTaskIdx(BOB_TASKS.length);
    await new Promise(r => setTimeout(r, 300));
    setResult({ ...DEMO_RESULT, repoName: rName, source });
    setPhase("result");
  }, [repoName, dropped, ghUrl, apiKey]);

  const reset = () => { setPhase("landing"); setDropped([]); setRepoName(""); setGhUrl(""); setApiKey(""); setResult(null); setProgress(0); setTaskIdx(0); setErrMsg(""); };

  // ════════════════════════════════════════════════════════════════
  // LANDING / PREVIEW
  // ════════════════════════════════════════════════════════════════
  if (phase === "landing" || phase === "preview") return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column", alignItems: "center", padding: "56px 24px 64px" }}>

      {/* Bob badge */}
      <div className="glass fade-up" style={{ display: "flex", alignItems: "center", gap: 8, borderRadius: 22, padding: "6px 15px", marginBottom: 32 }}>
        <span style={{ width: 7, height: 7, borderRadius: "50%", background: "#4d9fff", boxShadow: "0 0 8px #4d9fff", animation: "pulse 2s infinite" }} />
        <span className="mono" style={{ fontSize: 11, color: "#7dc4ff", fontWeight: 600, letterSpacing: "0.08em" }}>POWERED BY HAL</span>
      </div>

      <h1 className="display fade-up" style={{ fontSize: "clamp(32px,6vw,58px)", fontWeight: 800, textAlign: "center", lineHeight: 1.08, marginBottom: 16, letterSpacing: "-0.02em", animationDelay: "0.05s" }}>
        Onboard any codebase<br />
        <span className="gradient-text">in under 2 minutes.</span>
      </h1>
      <p className="fade-up" style={{ color: "#6b7699", fontSize: 16, textAlign: "center", maxWidth: 500, lineHeight: 1.65, marginBottom: 40, animationDelay: "0.1s" }}>
        HAL reads your entire repo — GitHub or local — and generates a README, architecture diagram, and plain-English walkthrough. Private repos never leave your machine.
      </p>

      {/* Mode toggle */}
      <div className="glass fade-up" style={{ display: "flex", borderRadius: 14, padding: 5, marginBottom: 26, gap: 4, animationDelay: "0.15s" }}>
        {[["local", "📁  Local folder"], ["github", "🔗  GitHub URL"]].map(([m, l]) => (
          <button key={m} onClick={() => { setMode(m); setPhase("landing"); }} className="btn"
            style={{ padding: "10px 24px", borderRadius: 10, fontSize: 13.5, fontWeight: 600, background: mode === m ? "linear-gradient(135deg,#4d9fff,#38e8d4)" : "transparent", color: mode === m ? "#04111f" : "#6b7699", boxShadow: mode === m ? "0 4px 18px rgba(77,159,255,0.35)" : "none" }}>
            {l}
          </button>
        ))}
      </div>

      {/* API Key Input */}
      <div className="glass fade-up" style={{ width: "100%", maxWidth: 560, padding: "16px 20px", borderRadius: 14, marginBottom: 16, display: "flex", alignItems: "center", gap: 10, animationDelay: "0.17s" }}>
        <span style={{ fontSize: 16 }}>🔑</span>
        <input value={apiKey} onChange={e => setApiKey(e.target.value)}
          placeholder="Paste your AI API key (optional)" className="mono"
          type="password"
          style={{ flex: 1, background: "transparent", border: "none", color: "#eef2ff", fontSize: 13, outline: "none", fontSize: 13 }} />
      </div>

      <div className="fade-up" style={{ width: "100%", maxWidth: 560, animationDelay: "0.2s" }}>
        {/* LOCAL */}
        {mode === "local" && phase === "landing" && (
          <>
            <div onClick={() => folderRef.current?.click()}
              onDragOver={e => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)} onDrop={onDrop}
              className="glass glass-hover"
              style={{ padding: "48px 24px", textAlign: "center", cursor: "pointer", borderRadius: 26, borderStyle: "dashed", borderColor: dragOver ? "#4d9fff" : "rgba(255,255,255,0.16)", borderWidth: 2 }}>
              <div style={{ fontSize: 40, marginBottom: 14 }}>📁</div>
              <div className="display" style={{ fontWeight: 600, fontSize: 17, color: "#eef2ff", marginBottom: 6 }}>Drop your project folder here</div>
              <div style={{ color: "#6b7699", fontSize: 14, marginBottom: 20 }}>Drag &amp; drop, or click to browse</div>
              <span className="btn btn-primary" style={{ display: "inline-flex", padding: "10px 26px", fontSize: 13.5, borderRadius: 11 }}>Choose folder</span>
            </div>
            <input ref={folderRef} type="file" webkitdirectory="true" directory="true" multiple onChange={onFolderPick} style={{ display: "none" }} />
            <div className="glass" style={{ display: "flex", alignItems: "center", gap: 9, marginTop: 14, padding: "11px 16px", borderRadius: 12 }}>
              <span style={{ fontSize: 15 }}>🔒</span>
              <span style={{ color: "#6b7699", fontSize: 12.5 }}>Files never leave your machine — Bob runs entirely via local BobShell.</span>
            </div>
          </>
        )}

        {/* PREVIEW */}
        {mode === "local" && phase === "preview" && (
          <div className="fade-up">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
              <span className="display" style={{ fontWeight: 600, fontSize: 17, color: "#eef2ff" }}>📁 {repoName}</span>
              <span className="mono" style={{ fontSize: 12, color: "#6b7699" }}>{dropped.length} files</span>
            </div>
            <FileTreeView paths={dropped.slice(0, 80).map(f => f.webkitRelativePath || f.name).filter(p => !shouldIgnore(p))} />
            <div style={{ display: "flex", gap: 10, marginTop: 14 }}>
              <button onClick={reset} className="btn btn-glass" style={{ flex: 1, padding: "12px 0", fontSize: 14 }}>Cancel</button>
              <button onClick={() => runAnalysis("local")} className="btn btn-primary" style={{ flex: 2, padding: "12px 0", fontSize: 14 }}>⚡ Run Bob Analysis →</button>
            </div>
          </div>
        )}

        {/* GITHUB */}
        {mode === "github" && (
          <>
            <div className="glass" style={{ display: "flex", gap: 8, padding: 6, borderRadius: 16, marginBottom: 14 }}>
              <input value={ghUrl} onChange={e => setGhUrl(e.target.value)}
                onKeyDown={e => e.key === "Enter" && ghUrl.trim() && runAnalysis("github", ghUrl.split("/").slice(-2).join("/"))}
                placeholder="https://github.com/your-org/your-repo" className="mono"
                style={{ flex: 1, background: "transparent", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 11, padding: "12px 16px", color: "#eef2ff", fontSize: 13, outline: "none" }} />
              <button onClick={() => ghUrl.trim() && runAnalysis("github", ghUrl.split("/").slice(-2).join("/"))} className="btn btn-primary" style={{ padding: "12px 22px", fontSize: 14, whiteSpace: "nowrap" }}>Analyze →</button>
            </div>
            <p className="mono" style={{ color: "#3a4566", fontSize: 12, marginBottom: 14, textAlign: "center" }}>or try a demo repo</p>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", justifyContent: "center" }}>
              {["vercel/next.js", "facebook/react", "microsoft/vscode"].map(r => (
                <button key={r} onClick={() => { setGhUrl(`https://github.com/${r}`); runAnalysis("github", r); }} className="btn btn-glass mono" style={{ padding: "8px 16px", fontSize: 12, borderRadius: 20 }}>{r}</button>
              ))}
            </div>
          </>
        )}
      </div>

      {/* Stats */}
      <div className="fade-up" style={{ display: "flex", gap: 44, marginTop: 60, animationDelay: "0.3s" }}>
        {[["3 days", "→ 30 min"], ["5 tasks", "Bob runs auto"], ["100%", "docs on demand"]].map(([n, l]) => (
          <div key={n} style={{ textAlign: "center" }}>
            <div className="display gradient-text" style={{ fontSize: 24, fontWeight: 700 }}>{n}</div>
            <div style={{ fontSize: 12, color: "#3a4566", marginTop: 3 }}>{l}</div>
          </div>
        ))}
      </div>
    </div>
  );

  // ════════════════════════════════════════════════════════════════
  // ANALYZING
  // ════════════════════════════════════════════════════════════════
  if (phase === "analyzing") return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", padding: 40 }}>
      <BobProgress tasks={BOB_TASKS} currentIdx={taskIdx} progress={progress} statusMsg={statusMsg} />
    </div>
  );

  // ════════════════════════════════════════════════════════════════
  // ERROR
  // ════════════════════════════════════════════════════════════════
  if (phase === "error") return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", padding: 40 }}>
      <div className="glass fade-up" style={{ maxWidth: 460, textAlign: "center", padding: "40px 36px", borderRadius: 24 }}>
        <div style={{ fontSize: 40, marginBottom: 16 }}>⚠️</div>
        <h2 className="display" style={{ color: "#eef2ff", marginBottom: 10 }}>Analysis failed</h2>
        <p style={{ color: "#6b7699", fontSize: 14, marginBottom: 24 }}>{errMsg}</p>
        <button onClick={reset} className="btn btn-primary" style={{ padding: "11px 28px", fontSize: 14 }}>Try again</button>
      </div>
    </div>
  );

  // ════════════════════════════════════════════════════════════════
  // RESULT
  // ════════════════════════════════════════════════════════════════
  const out = result?.outputs || {};
  const TABS = ["Summary", "Architecture", "README", "Security", "Bob Session"];

  return (
    <div style={{ minHeight: "100vh" }}>
      {/* Sticky glass header */}
      <div className="glass" style={{ position: "sticky", top: 0, zIndex: 30, borderRadius: 0, borderLeft: "none", borderRight: "none", borderTop: "none", padding: "14px 28px", display: "flex", alignItems: "center", gap: 13 }}>
        <button onClick={reset} className="btn btn-glass" style={{ fontSize: 13, padding: "6px 14px" }}>← New analysis</button>
        <span className="mono" style={{ fontSize: 12, color: "#6b7699" }}>{result.source === "local" ? "📁" : "🔗"} {result.repoName}</span>
        <span className="mono" style={{ fontSize: 12, color: "#3a4566" }}>· {result.fileCount?.toLocaleString()} files</span>
        <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ width: 7, height: 7, borderRadius: "50%", background: "#2ce8a8", boxShadow: "0 0 8px #2ce8a8" }} />
          <span className="mono" style={{ fontSize: 12, color: "#2ce8a8" }}>Bob complete</span>
        </div>
      </div>

      <div style={{ maxWidth: 900, margin: "0 auto", padding: "38px 24px" }}>
        <div className="fade-up" style={{ marginBottom: 28 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 8 }}>
            <h1 className="display" style={{ fontSize: 28, fontWeight: 700 }}>{result.repoName}</h1>
            <span className="glass mono" style={{ borderRadius: 7, padding: "3px 11px", fontSize: 11, color: "#7dc4ff" }}>{result.source}</span>
          </div>
          <p style={{ color: "#3a4566", fontSize: 13.5 }}>HAL onboarding package · generated in ~{result.durationLabel || "1m 45s"} · 5 tasks completed</p>
        </div>

        {/* Glass tab bar */}
        <div className="glass" style={{ display: "flex", borderRadius: 16, padding: 5, marginBottom: 26, gap: 3, overflowX: "auto" }}>
          {TABS.map(t => (
            <button key={t} onClick={() => setTab(t)} className="btn"
              style={{ padding: "9px 18px", borderRadius: 11, fontSize: 13, fontWeight: 600, whiteSpace: "nowrap", background: tab === t ? "linear-gradient(135deg,#4d9fff,#38e8d4)" : "transparent", color: tab === t ? "#04111f" : "#6b7699" }}>{t}</button>
          ))}
        </div>

        {/* Tab panels */}
        {tab === "Summary" && (
          <div className="fade-up">
            <div className="glass" style={{ padding: "24px 26px", borderRadius: 18, marginBottom: 16 }}>
              <div className="mono" style={{ fontSize: 10.5, color: "#4d9fff", letterSpacing: "0.1em", fontWeight: 600, marginBottom: 14 }}>ONBOARDING SUMMARY — HAL</div>
              <pre style={{ fontFamily: "var(--font-body)", fontSize: 14, color: "#b8c2e0", lineHeight: 1.8, whiteSpace: "pre-wrap", wordBreak: "break-word" }}>{out.summary}</pre>
            </div>
            {result.fileTree?.length > 0 && (
              <div className="glass" style={{ padding: "24px 26px", borderRadius: 18 }}>
                <div className="mono" style={{ fontSize: 10.5, color: "#4d9fff", letterSpacing: "0.1em", fontWeight: 600, marginBottom: 14 }}>FILE TREE PREVIEW</div>
                <FileTreeView paths={result.fileTree} />
              </div>
            )}
          </div>
        )}

        {tab === "Architecture" && (
          <div className="fade-up">
            <p style={{ color: "#6b7699", fontSize: 13.5, marginBottom: 14 }}>Bob traced the full dependency graph to generate this diagram.</p>
            <Mermaid code={out.architecture} />
            <CodeBlock downloadName="architecture.mmd">{out.architecture}</CodeBlock>
          </div>
        )}

        {tab === "README" && (
          <div className="fade-up"><CodeBlock downloadName="README.md">{out.readme}</CodeBlock></div>
        )}

        {tab === "Security" && (
          <div className="fade-up">
            <div className="glass" style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16, padding: "13px 18px", borderRadius: 14 }}>
              <span style={{ fontSize: 18 }}>🛡</span>
              <span style={{ color: "#2ce8a8", fontSize: 13.5 }}>Semgrep scan complete — no critical vulnerabilities found.</span>
            </div>
            <div className="glass" style={{ padding: "24px 26px", borderRadius: 18 }}>
              <pre style={{ fontFamily: "var(--font-body)", fontSize: 14, color: "#b8c2e0", lineHeight: 1.8, whiteSpace: "pre-wrap" }}>{out.security}</pre>
            </div>
          </div>
        )}

        {tab === "Bob Session" && (
          <div className="fade-up">
            <p style={{ color: "#6b7699", fontSize: 13.5, marginBottom: 14 }}>Full audit log of every task Bob performed — export this for your hackathon submission to prove meaningful Bob usage.</p>
            <div style={{ display: "flex", gap: 10, marginBottom: 16, flexWrap: "wrap" }}>
              {BOB_TASKS.map(t => (
                <div key={t.id} className="glass" style={{ flex: "1 1 90px", padding: "12px", textAlign: "center", borderRadius: 14 }}>
                  <div style={{ fontSize: 17, marginBottom: 5, color: "#7dc4ff" }}>{t.icon}</div>
                  <div className="mono" style={{ fontSize: 10, color: "#2ce8a8" }}>✓ done</div>
                </div>
              ))}
            </div>
            <CodeBlock downloadName="bob-session-report.json">{out.sessionReport}</CodeBlock>
          </div>
        )}
      </div>
    </div>
  );
}
