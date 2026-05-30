// Shared constants and helpers for the Repo Onboarding Assistant

export const IGNORE_DIRS = ["node_modules", ".git", ".next", "dist", "build", "__pycache__", ".turbo", ".cache", ".venv", "venv", "coverage", "out"];
export const BINARY_EXTS = [".png", ".jpg", ".jpeg", ".gif", ".ico", ".webp", ".woff", ".woff2", ".ttf", ".eot", ".zip", ".tar", ".gz", ".pdf", ".bin", ".lock", ".mp4", ".mov"];
export const MAX_FILE_KB = 200;

export const BOB_TASKS = [
  { id: "scan",     label: "Clone & full context scan", icon: "◎" },
  { id: "readme",   label: "Generate README.md",         icon: "✎" },
  { id: "arch",     label: "Architecture diagram",       icon: "◈" },
  { id: "summary",  label: "Plain-English summary",      icon: "✦" },
  { id: "security", label: "Security scan (Semgrep)",    icon: "⬡" },
];

export function shouldIgnore(relPath) {
  const norm = relPath.replace(/\\/g, "/");
  if (IGNORE_DIRS.some(d => norm.includes(`/${d}/`) || norm.startsWith(`${d}/`))) return true;
  const ext = "." + norm.split(".").pop().toLowerCase();
  return BINARY_EXTS.includes(ext);
}

export function buildFileTree(paths) {
  const tree = {};
  paths.forEach(p => {
    const parts = p.replace(/\\/g, "/").split("/").filter(Boolean);
    let node = tree;
    parts.forEach((part, i) => {
      if (!node[part]) node[part] = i === parts.length - 1 ? null : {};
      if (node[part] !== null) node = node[part];
    });
  });
  return tree;
}

export function fmtBytes(kb) {
  if (kb < 1024) return `${kb.toFixed(1)} KB`;
  return `${(kb / 1024).toFixed(1)} MB`;
}
