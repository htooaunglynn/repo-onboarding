/**
 * app/api/onboard-local/route.js
 * ─────────────────────────────────────────────────────────────────
 * Next.js App Router API route.
 * Receives file tree from the browser folder picker,
 * builds a Bob context bundle, runs BobShell, streams results back.
 *
 * POST /api/onboard-local
 * Body: FormData with multiple File entries (the folder contents)
 */

import { NextResponse } from "next/server";
import { writeFile, mkdir, readFile } from "fs/promises";
import { existsSync } from "fs";
import path from "path";
import { exec } from "child_process";
import { promisify } from "util";

const execAsync = promisify(exec);

// Max file size to include in Bob context (200 KB per file)
const MAX_FILE_KB = 200;

// Folders/patterns to strip from uploaded paths
const IGNORE_PATTERNS = [
  "node_modules", ".git", ".next", "dist", "build", "__pycache__",
  ".venv", "venv", ".turbo", ".cache", "coverage",
];

function shouldIgnore(filePath) {
  return IGNORE_PATTERNS.some(p => filePath.includes(`/${p}/`) || filePath.startsWith(`${p}/`));
}

export async function POST(request) {
  try {
    const formData = await request.formData();
    const files = formData.getAll("files");       // File objects
    const paths = formData.getAll("paths");       // relative paths matching each file
    const repoName = formData.get("repoName") || "local-repo";
    const apiKey = formData.get("apiKey");

    if (!files.length) {
      return NextResponse.json({ error: "No files received" }, { status: 400 });
    }

    if (!apiKey) {
      return NextResponse.json({ error: "API key is required" }, { status: 400 });
    }

    // ── 1. Build work directory ──────────────────────────────────
    const workDir = path.join(process.cwd(), ".bob-work", Date.now().toString());
    await mkdir(workDir, { recursive: true });

    // ── 2. Build Bob context bundle ──────────────────────────────
    let contextBundle = `REPOSITORY: ${repoName}\nANALYZED: ${new Date().toISOString()}\n\n`;
    let fileCount = 0;
    const fileTree = [];

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const relPath = paths[i] || file.name;

      if (shouldIgnore(relPath)) continue;
      if (file.size / 1024 > MAX_FILE_KB) continue;

      const text = await file.text().catch(() => null);
      if (!text) continue; // skip binary files

      contextBundle += `${"=".repeat(60)}\n`;
      contextBundle += `FILE: ${relPath} (${(file.size / 1024).toFixed(1)} KB)\n`;
      contextBundle += `${"=".repeat(60)}\n`;
      contextBundle += text + "\n\n";

      fileTree.push(relPath);
      fileCount++;
    }

    // ── 3. Write context to disk ─────────────────────────────────
    const contextFile = path.join(workDir, "repo-context.txt");
    await writeFile(contextFile, contextBundle, "utf8");

    // ── 4. Write BobShell recipe ─────────────────────────────────
    const outputDir = path.join(workDir, "outputs");
    await mkdir(outputDir, { recursive: true });

    const recipe = buildRecipe({ repoName, contextFile, outputDir });
    const recipeFile = path.join(workDir, "local-onboard.recipe");
    await writeFile(recipeFile, recipe, "utf8");

    // ── 5. Run Bob (or fallback) ─────────────────────────────────
    let bobOutput = null;
    let usedFallback = false;

    try {
      // Check if bob CLI is available
      await execAsync("bob --version");
      // Run BobShell
      const { stdout } = await execAsync(
        `bob shell run "${recipeFile}" --context "${contextFile}"`,
        { timeout: 120_000 } // 2 min timeout
      );
      bobOutput = stdout;
    } catch {
      // Bob CLI not available — use fallback Anthropic API
      usedFallback = true;
      bobOutput = await runFallbackAnalysis(contextBundle, repoName, outputDir);
    }

    // ── 6. Read generated files ──────────────────────────────────
    const readSafe = async (filePath) => {
      try { return await readFile(filePath, "utf8"); } catch { return null; }
    };

    const [readme, architecture, summary, security, sessionReport] = await Promise.all([
      readSafe(path.join(outputDir, "README.md")),
      readSafe(path.join(outputDir, "architecture.mmd")),
      readSafe(path.join(outputDir, "onboarding-summary.md")),
      readSafe(path.join(outputDir, "security-report.md")),
      readSafe(path.join(outputDir, "bob-session-report.json")),
    ]);

    return NextResponse.json({
      success: true,
      repoName,
      fileCount,
      fileTree: fileTree.slice(0, 50), // preview only
      usedFallback,
      outputs: { readme, architecture, summary, security, sessionReport },
      workDir, // for debugging
    });

  } catch (error) {
    console.error("[onboard-local] Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// ── Build BobShell recipe ────────────────────────────────────────
function buildRecipe({ repoName, contextFile, outputDir }) {
  return `recipe:
  name: "Local Repo Onboarding — ${repoName}"
  version: "1.0.0"

tasks:
  - id: scan
    mode: architect
    context_file: "${contextFile}"
    prompt: |
      Analyze the complete source code of "${repoName}".
      Identify: purpose, modules/services, entry points, dependencies, data flow, tech stack.
      Output structured JSON.

  - id: readme
    mode: code
    depends_on: scan
    prompt: |
      Generate a complete README.md for "${repoName}".
      Include: description, prerequisites, install, usage, project structure, tests.
      Only document what is actually in the code.
    output_file: "${outputDir}/README.md"

  - id: architecture
    mode: architect
    depends_on: scan
    prompt: |
      Generate a Mermaid graph TD diagram of all modules, services, and data flows in "${repoName}".
    output_file: "${outputDir}/architecture.mmd"

  - id: summary
    mode: architect
    depends_on: scan
    prompt: |
      Write a plain-English onboarding summary for "${repoName}" covering:
      what it does, how it works, top 5 files to read first, common dev tasks, gotchas.
    output_file: "${outputDir}/onboarding-summary.md"

  - id: security
    mode: code
    depends_on: scan
    prompt: |
      Review "${repoName}" for: hardcoded secrets, dangerous code patterns, risky dependencies.
      Report each finding with severity level.
    output_file: "${outputDir}/security-report.md"

on_complete:
  export_bob_session_report: true
  report_path: "${outputDir}/bob-session-report.json"
`;
}

// ── Fallback: use Anthropic API directly (demo mode) ─────────────
async function runFallbackAnalysis(contextBundle, repoName, outputDir) {
  const { writeFile } = await import("fs/promises");

  const truncated = contextBundle.slice(0, 80_000); // ~20k tokens

  const tasks = [
    {
      id: "readme",
      file: "README.md",
      prompt: `You are HAL, an AI development partner. Analyze this codebase called "${repoName}" and generate a complete README.md with: project description, prerequisites, installation steps, usage examples, project structure, and how to run tests. Only document what you actually see in the code.\n\nCODEBASE:\n${truncated}`,
    },
    {
      id: "architecture",
      file: "architecture.mmd",
      prompt: `You are HAL. Analyze this codebase called "${repoName}" and generate ONLY a Mermaid graph TD diagram (no explanation, just the diagram code) showing all major modules, services, and data flows.\n\nCODEBASE:\n${truncated}`,
    },
    {
      id: "summary",
      file: "onboarding-summary.md",
      prompt: `You are HAL. Write a plain-English onboarding summary for "${repoName}" covering: 1) What this project does 2) How it works 3) Top 5 files to read first (with one sentence each) 4) Common dev tasks 5) Gotchas and non-obvious things.\n\nCODEBASE:\n${truncated}`,
    },
    {
      id: "security",
      file: "security-report.md",
      prompt: `You are HAL. Review this codebase "${repoName}" for security issues: hardcoded secrets/tokens, dangerous patterns (SQLi, XSS, eval misuse), risky dependencies. Rate each finding critical/high/medium/low/info.\n\nCODEBASE:\n${truncated}`,
    },
  ];

  const sessionTasks = [];

  for (const task of tasks) {
    const start = Date.now();
    try {
      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-api-key": apiKey },
        body: JSON.stringify({
          model: "claude-sonnet-4-20250514",
          max_tokens: 1000,
          messages: [{ role: "user", content: task.prompt }],
        }),
      });
      const data = await res.json();
      const text = data.content?.map(c => c.text || "").join("") || "";
      await writeFile(path.join(outputDir, task.file), text, "utf8");
      sessionTasks.push({ id: task.id, status: "done", timeMs: Date.now() - start });
    } catch (err) {
      sessionTasks.push({ id: task.id, status: "error", error: err.message });
    }
  }

  const sessionReport = {
    session: "bob-local-fallback",
    repo: repoName,
    mode: "anthropic-api-fallback",
    tasks: sessionTasks,
    note: "Bob CLI not found. Used Anthropic API in demo mode.",
  };
  await writeFile(
    path.join(outputDir, "bob-session-report.json"),
    JSON.stringify(sessionReport, null, 2),
    "utf8"
  );

  return sessionReport;
}
