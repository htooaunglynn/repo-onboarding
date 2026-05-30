/**
 * app/api/onboard-github/route.js
 * ─────────────────────────────────────────────────────────────────
 * Fetches a GitHub repo's file tree + contents via the GitHub API,
 * builds a Bob context bundle, runs BobShell, returns the onboarding pack.
 *
 * POST /api/onboard-github
 * Body: { url: "https://github.com/org/repo", token?: "ghp_..." }
 *
 * For PRIVATE repos, pass a GitHub personal access token.
 * The token is used only for this request and never stored.
 */

import { NextResponse } from "next/server";
import { writeFile, mkdir, readFile } from "fs/promises";
import path from "path";
import { exec } from "child_process";
import { promisify } from "util";

const execAsync = promisify(exec);
const MAX_FILE_KB = 200;
const IGNORE = ["node_modules", ".git", ".next", "dist", "build", "__pycache__"];

async function callAI(provider, apiKey, prompt) {
  if (provider === "openai") {
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": `Bearer ${apiKey}` },
      body: JSON.stringify({ model: "gpt-4o", max_tokens: 1000, messages: [{ role: "user", content: prompt }] }),
    });
    const d = await res.json();
    return d.choices?.[0]?.message?.content || "";
  }
  if (provider === "google") {
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] }),
    });
    const d = await res.json();
    return d.candidates?.[0]?.content?.parts?.[0]?.text || "";
  }
  // default: anthropic
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-api-key": apiKey },
    body: JSON.stringify({ model: "claude-sonnet-4-20250514", max_tokens: 1000, messages: [{ role: "user", content: prompt }] }),
  });
  const d = await res.json();
  return d.content?.map(c => c.text || "").join("") || "";
}

function parseRepo(url) {
  const m = url.match(/github\.com\/([^/]+)\/([^/]+?)(?:\.git|\/|$)/);
  if (!m) return null;
  return { owner: m[1], repo: m[2] };
}

export async function POST(request) {
  try {
    const { url, token, apiKey, provider } = await request.json();
    const parsed = parseRepo(url || "");
    if (!parsed) return NextResponse.json({ error: "Invalid GitHub URL" }, { status: 400 });

    if (!apiKey) {
      return NextResponse.json({ error: "API key is required" }, { status: 400 });
    }

    const { owner, repo } = parsed;
    const headers = { Accept: "application/vnd.github+json", "User-Agent": "repo-onboarding-assistant" };
    if (token) headers.Authorization = `Bearer ${token}`;

    // 1. Get default branch
    const repoMeta = await fetch(`https://api.github.com/repos/${owner}/${repo}`, { headers }).then(r => r.json());
    if (repoMeta.message) return NextResponse.json({ error: `GitHub: ${repoMeta.message}` }, { status: 404 });
    const branch = repoMeta.default_branch || "main";

    // 2. Get full file tree (recursive)
    const tree = await fetch(`https://api.github.com/repos/${owner}/${repo}/git/trees/${branch}?recursive=1`, { headers }).then(r => r.json());
    const blobs = (tree.tree || []).filter(n => n.type === "blob" && !IGNORE.some(ig => n.path.includes(`${ig}/`)) && (n.size || 0) / 1024 <= MAX_FILE_KB);

    // 3. Fetch contents (cap at ~150 files to stay within rate limits for demo)
    const sample = blobs.slice(0, 150);
    let contextBundle = `REPOSITORY: ${owner}/${repo}\nBRANCH: ${branch}\n\n`;
    let fileCount = 0;
    const fileTree = [];

    for (const blob of sample) {
      try {
        const raw = await fetch(`https://raw.githubusercontent.com/${owner}/${repo}/${branch}/${blob.path}`, { headers }).then(r => r.text());
        contextBundle += `${"=".repeat(60)}\nFILE: ${blob.path}\n${"=".repeat(60)}\n${raw}\n\n`;
        fileTree.push(blob.path);
        fileCount++;
      } catch { /* skip */ }
    }

    // 4. Build work dir + recipe, run Bob
    const workDir = path.join(process.cwd(), ".bob-work", Date.now().toString());
    const outputDir = path.join(workDir, "outputs");
    await mkdir(outputDir, { recursive: true });
    const contextFile = path.join(workDir, "repo-context.txt");
    await writeFile(contextFile, contextBundle, "utf8");

    let usedFallback = false;
    try {
      await execAsync("bob --version");
      const recipeFile = path.join(workDir, "onboard.recipe");
      await writeFile(recipeFile, githubRecipe({ repoName: `${owner}/${repo}`, contextFile, outputDir }), "utf8");
      await execAsync(`bob shell run "${recipeFile}" --context "${contextFile}"`, { timeout: 120000 });
    } catch {
      usedFallback = true;
      await runFallback(contextBundle, `${owner}/${repo}`, outputDir, apiKey, provider || "anthropic");
    }

    const readSafe = async f => { try { return await readFile(path.join(outputDir, f), "utf8"); } catch { return null; } };
    const [readme, architecture, summary, security, sessionReport] = await Promise.all([
      readSafe("README.md"), readSafe("architecture.mmd"), readSafe("onboarding-summary.md"), readSafe("security-report.md"), readSafe("bob-session-report.json"),
    ]);

    return NextResponse.json({
      success: true, repoName: `${owner}/${repo}`, source: "github", fileCount,
      fileTree: fileTree.slice(0, 50), usedFallback,
      outputs: { summary, architecture, readme, security, sessionReport },
    });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

function githubRecipe({ repoName, contextFile, outputDir }) {
  return `recipe:
  name: "GitHub Repo Onboarding — ${repoName}"
tasks:
  - id: scan
    mode: architect
    context_file: "${contextFile}"
    prompt: |
      Analyze the repository "${repoName}". Identify purpose, modules, entry points, dependencies, data flow, tech stack. Output JSON.
  - id: readme
    mode: code
    depends_on: scan
    prompt: "Generate a complete README.md. Only document what is in the code."
    output_file: "${outputDir}/README.md"
  - id: architecture
    mode: architect
    depends_on: scan
    prompt: "Generate a Mermaid graph TD diagram of all modules and data flows."
    output_file: "${outputDir}/architecture.mmd"
  - id: summary
    mode: architect
    depends_on: scan
    prompt: "Write a plain-English onboarding summary: what it does, how it works, top 5 files, common tasks, gotchas."
    output_file: "${outputDir}/onboarding-summary.md"
  - id: security
    mode: code
    depends_on: scan
    prompt: "Scan for secrets, dangerous patterns, risky deps. Rate each finding."
    output_file: "${outputDir}/security-report.md"
on_complete:
  export_bob_session_report: true
  report_path: "${outputDir}/bob-session-report.json"
`;
}

async function runFallback(contextBundle, repoName, outputDir, apiKey, provider) {
  const truncated = contextBundle.slice(0, 80000);
  const tasks = [
    { file: "onboarding-summary.md", prompt: `You are HAL. Write a plain-English onboarding summary for "${repoName}": 1) What it does 2) How it works 3) Top 5 files to read first 4) Common dev tasks 5) Gotchas.\n\n${truncated}` },
    { file: "README.md", prompt: `You are HAL. Generate a complete README.md for "${repoName}" based only on the code.\n\n${truncated}` },
    { file: "architecture.mmd", prompt: `You are HAL. Output ONLY a Mermaid graph TD diagram for "${repoName}".\n\n${truncated}` },
    { file: "security-report.md", prompt: `You are HAL. Security scan of "${repoName}": secrets, dangerous patterns, risky deps with severity.\n\n${truncated}` },
  ];
  for (const t of tasks) {
    try {
      const text = await callAI(provider, apiKey, t.prompt);
      await writeFile(path.join(outputDir, t.file), text, "utf8");
    } catch { /* skip */ }
  }
  await writeFile(path.join(outputDir, "bob-session-report.json"), JSON.stringify({ session: "bob-github-fallback", repo: repoName, mode: `${provider}-api-fallback` }, null, 2), "utf8");
}
