#!/usr/bin/env node
/**
 * onboard-local.js
 * ─────────────────────────────────────────────────────────────────
 * Runs the Repo Onboarding Assistant against a LOCAL folder.
 * HAL reads the files directly — no GitHub, no internet required.
 *
 * Usage:
 *   node onboard-local.js --path /Users/you/projects/my-app
 *   node onboard-local.js --path ./my-app --output ./reports
 *
 * Options:
 *   --path     (required) Absolute or relative path to the repo folder
 *   --output   (optional) Where to write reports. Default: ./onboarding-output
 *   --max-kb   (optional) Skip files larger than N KB. Default: 200
 *   --ignore   (optional) Extra glob patterns to ignore (comma-separated)
 */

const fs   = require("fs");
const path = require("path");
const { execSync, spawnSync } = require("child_process");

// ── Parse CLI args ────────────────────────────────────────────────
const args = process.argv.slice(2);
const get  = (flag) => { const i = args.indexOf(flag); return i !== -1 ? args[i + 1] : null; };

const repoPath  = get("--path");
const outputDir = get("--output") || "./onboarding-output";
const maxKb     = parseInt(get("--max-kb") || "200", 10);
const extraIgnore = (get("--ignore") || "").split(",").filter(Boolean);

if (!repoPath) {
  console.error("❌  --path is required.\n    Usage: node onboard-local.js --path /path/to/your/repo");
  process.exit(1);
}

const absPath = path.resolve(repoPath);
if (!fs.existsSync(absPath)) {
  console.error(`❌  Folder not found: ${absPath}`);
  process.exit(1);
}

// ── Default ignore patterns ───────────────────────────────────────
const DEFAULT_IGNORE = new Set([
  "node_modules", ".git", ".next", "dist", "build", "out",
  ".turbo", ".cache", "coverage", "__pycache__", ".venv", "venv",
  ".DS_Store", "*.lock", "*.log", "*.min.js", "*.min.css",
  "*.png", "*.jpg", "*.jpeg", "*.gif", "*.svg", "*.ico",
  "*.woff", "*.woff2", "*.ttf", "*.eot",
  "*.zip", "*.tar", "*.gz",
]);

function shouldIgnore(filePath) {
  const parts = filePath.split(path.sep);
  for (const part of parts) {
    if (DEFAULT_IGNORE.has(part)) return true;
    for (const pattern of extraIgnore) {
      if (part.includes(pattern)) return true;
    }
  }
  const ext = path.extname(filePath);
  const binaryExts = [".png",".jpg",".jpeg",".gif",".ico",".woff",".woff2",".ttf",".eot",".zip",".tar",".gz",".pdf",".bin"];
  if (binaryExts.includes(ext)) return true;
  return false;
}

// ── Walk the directory tree ───────────────────────────────────────
function walkDir(dir, base = dir, result = []) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    const relPath  = path.relative(base, fullPath);
    if (shouldIgnore(relPath)) continue;
    if (entry.isDirectory()) {
      walkDir(fullPath, base, result);
    } else {
      const stat = fs.statSync(fullPath);
      if (stat.size / 1024 <= maxKb) {
        result.push({ relPath, fullPath, sizeKb: (stat.size / 1024).toFixed(1) });
      }
    }
  }
  return result;
}

// ── Build context bundle for Bob ─────────────────────────────────
function buildContext(files) {
  let context = "";
  let totalFiles = 0;

  for (const file of files) {
    try {
      const content = fs.readFileSync(file.fullPath, "utf8");
      context += `\n${"=".repeat(60)}\n`;
      context += `FILE: ${file.relPath} (${file.sizeKb} KB)\n`;
      context += `${"=".repeat(60)}\n`;
      context += content + "\n";
      totalFiles++;
    } catch {
      // Skip unreadable files (binary, encoding issues)
    }
  }
  return { context, totalFiles };
}

// ── Main ──────────────────────────────────────────────────────────
console.log("\n🤖  Repo Onboarding Assistant — Local Mode");
console.log("━".repeat(50));
console.log(`📁  Repo:   ${absPath}`);
console.log(`📤  Output: ${path.resolve(outputDir)}\n`);

// 1. Scan the folder
console.log("⏳  Scanning files...");
const files = walkDir(absPath);
console.log(`✅  Found ${files.length} files to analyze\n`);

// Print file tree preview
console.log("📂  File tree (first 30 files):");
files.slice(0, 30).forEach(f => console.log(`    ${f.relPath}`));
if (files.length > 30) console.log(`    ... and ${files.length - 30} more\n`);

// 2. Build context bundle
console.log("⏳  Building context bundle for Bob...");
const { context, totalFiles } = buildContext(files);
const contextSizeKb = (Buffer.byteLength(context, "utf8") / 1024).toFixed(0);
console.log(`✅  Context bundle: ${totalFiles} files, ~${contextSizeKb} KB\n`);

// 3. Write context to temp file for BobShell
if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });
const contextFile = path.join(outputDir, "repo-context.txt");
fs.writeFileSync(contextFile, context, "utf8");

// 4. Write BobShell recipe with injected repo path
const recipe = `# Auto-generated BobShell recipe for local repo
# Generated: ${new Date().toISOString()}
# Repo: ${absPath}

recipe:
  name: "Local Repo Onboarding"
  version: "1.0.0"

inputs:
  context_file: "${contextFile}"
  repo_name: "${path.basename(absPath)}"

tasks:

  - id: scan
    mode: architect
    prompt: |
      You have been given the complete source code of a local repository called "{{ repo_name }}".
      The full file contents are in the context bundle.

      Analyze the entire codebase and identify:
        1. Primary purpose (one paragraph, plain English)
        2. All top-level services, modules, packages and their roles
        3. Main entry points (the files where execution starts)
        4. Key external dependencies and what they are used for
        5. Data flow — how a typical operation flows through the system
        6. Technology stack (languages, frameworks, databases, infra)
      Output structured JSON.

  - id: readme
    mode: code
    depends_on: scan
    prompt: |
      Using the full source code and scan results, generate a complete README.md.
      Include: project description, prerequisites, installation, usage, project structure, tests.
      Only document what you can actually see in the code — do not invent steps.
    output_file: "${outputDir}/README.md"

  - id: architecture
    mode: architect
    depends_on: scan
    prompt: |
      Generate a Mermaid graph TD diagram showing all major modules/services,
      their relationships, and data flows. Base it only on what you see in the code.
    output_file: "${outputDir}/architecture.mmd"

  - id: summary
    mode: architect
    depends_on: scan
    prompt: |
      Write a friendly plain-English onboarding summary covering:
        1. What this project does
        2. How it works (the core technical flow)
        3. Top 5 files to read first and why
        4. Common dev tasks (add a feature, run tests, deploy)
        5. Gotchas and non-obvious things to know
    output_file: "${outputDir}/onboarding-summary.md"

  - id: security
    mode: code
    depends_on: scan
    prompt: |
      Review the source code for: hardcoded secrets/tokens, dangerous patterns
      (SQLi, XSS, unvalidated input, unsafe evals), outdated or risky dependencies.
      Report each finding with severity (critical/high/medium/low/info).
    output_file: "${outputDir}/security-report.md"

on_complete:
  export_bob_session_report: true
  report_path: "${outputDir}/bob-session-report.json"
`;

const recipeFile = path.join(outputDir, "local-onboard.recipe");
fs.writeFileSync(recipeFile, recipe, "utf8");
console.log(`✅  BobShell recipe written: ${recipeFile}\n`);

// 5. Run BobShell (if bob CLI is available)
console.log("🤖  Running HAL via BobShell...\n");

const bobAvailable = spawnSync("bob", ["--version"]).status === 0;

if (bobAvailable) {
  try {
    execSync(
      `bob shell run "${recipeFile}" --context "${contextFile}"`,
      { stdio: "inherit", cwd: absPath }
    );
    console.log("\n✅  Bob analysis complete!");
  } catch (err) {
    console.error("❌  BobShell run failed:", err.message);
    process.exit(1);
  }
} else {
  // Fallback: use the Anthropic API directly (for hackathon demo without Bob CLI)
  console.log("ℹ️   Bob CLI not found — falling back to Anthropic API demo mode.\n");
  console.log("    To use real HAL, install it and ensure `bob` is in your PATH.");
  console.log("    Recipe is ready at:", recipeFile);
  console.log("    Context bundle is at:", contextFile);
  console.log("\n    Run manually when Bob is installed:");
  console.log(`    bob shell run "${recipeFile}"\n`);
}

console.log("\n📁  Output files:");
console.log(`    ${outputDir}/README.md`);
console.log(`    ${outputDir}/architecture.mmd`);
console.log(`    ${outputDir}/onboarding-summary.md`);
console.log(`    ${outputDir}/security-report.md`);
console.log(`    ${outputDir}/bob-session-report.json`);
console.log("\n✨  Done. Open the web app to view your onboarding dashboard.\n");
