// Pre-baked Bob analysis used for demo mode (when Bob CLI / API isn't wired yet).
import { BOB_TASKS } from "./utils";

export const DEMO_RESULT = {
  repoName: "vercel/next.js",
  source: "github",
  fileCount: 4248,
  durationLabel: "1m 45s",
  fileTree: [
    "packages/next/src/server/next.ts",
    "packages/next/src/build/index.ts",
    "packages/next/src/client/app-index.tsx",
    "packages/next/src/server/app-render/app-render.tsx",
    "packages/next/src/server/render.tsx",
    "packages/next/src/build/webpack/config.ts",
    "packages/next/cli/next-dev.ts",
    "packages/next/cli/next-build.ts",
    "turbopack/crates/turbopack-core/src/lib.rs",
    "test/e2e/app-dir/basic.test.ts",
  ],
  outputs: {
    summary: `# What this project does
Next.js is a full-stack React framework maintained by Vercel. It provides server-side rendering, static site generation, API routes, and a file-system-based router — letting developers ship production React apps without manual bundler or server configuration.

# How it works
At its core, Next.js wraps Webpack/Turbopack into a CLI. When you run \`next build\`, it crawls your \`app/\` or \`pages/\` directory, detects which routes are static vs dynamic, and emits optimised server/client bundles. The Node.js server handles SSR at request time; static routes are pre-rendered and served from CDN. React Server Components run on the server by default — only client components ship JS to the browser.

# Top 5 files to read first
1. packages/next/src/server/next.ts — Root of the Node.js server, start here for runtime request handling.
2. packages/next/src/build/index.ts — Orchestrates the full build pipeline from source to optimised output.
3. packages/next/src/client/app-index.tsx — Client-side hydration entry for the App Router.
4. packages/next/src/server/app-render/app-render.tsx — RSC rendering logic.
5. turbopack/crates/turbopack-core/src/lib.rs — Core of the Rust-based Turbopack bundler.

# Common dev tasks
- Add a page: create a file in app/ or pages/ — routing is automatic.
- Run tests: pnpm jest test/e2e/app-dir/basic.test.ts
- Debug a build: NEXT_DEBUG_BUILD=1 pnpm build

# Gotchas & quirks
- The repo is a monorepo — most source lives in packages/next/src/, not the root.
- Turbopack (Rust) and Webpack (JS) coexist; Turbopack is now the default for next dev.
- app/ (App Router) and pages/ (Pages Router) have separate rendering pipelines.
- Test infra spans test/, packages/*/src/__tests__/, and e2e/ — no single runner entry.`,
    architecture: `graph TD
  CLI["next CLI"] --> Build["Build Pipeline"]
  CLI --> DevServer["Dev Server"]
  Build --> Turbopack["Turbopack (Rust)"]
  Build --> Webpack["Webpack"]
  Build --> Output[".next output"]
  DevServer --> Turbopack
  Output --> NodeServer["Node.js Server"]
  NodeServer --> AppRender["App Router Renderer"]
  NodeServer --> PagesRender["Pages Router Renderer"]
  AppRender --> RSC["React Server Components"]
  AppRender --> Client["Client JS Bundle"]
  NodeServer --> API["API Routes"]`,
    readme: `# Next.js

The React Framework for the Web.

## Prerequisites
- Node.js >= 18.18
- pnpm 9+ (this repo uses pnpm workspaces)
- Rust toolchain for Turbopack (rustup show)

## Installation
\`\`\`bash
git clone https://github.com/vercel/next.js
cd next.js
pnpm install
pnpm build
\`\`\`

## Running tests
\`\`\`bash
pnpm jest test/e2e/app-dir/basic.test.ts
\`\`\`

## Project structure
\`\`\`
packages/next/src/
  server/   Node.js runtime, SSR, App/Pages Router
  build/    Build pipeline (Webpack + Turbopack wrappers)
  client/   Client-side hydration & React entry points
turbopack/  Rust-based bundler
test/e2e/   End-to-end test suite
\`\`\``,
    security: `## Security Scan — vercel/next.js

[OK]   No hardcoded secrets or tokens detected across 4,248 files.
[OK]   All dependencies pinned in pnpm-lock.yaml.
[OK]   No known critical CVEs in direct dependencies at scan time.

[LOW]  Several eval() calls in legacy Webpack plugin shims.
       Not exploitable from userland but worth noting for audits.

[INFO] Some internal APIs exported without @internal JSDoc.
       May change without semver notice; avoid relying on them.`,
    sessionReport: JSON.stringify({
      session: "bob-hackathon-2026",
      repo: "vercel/next.js",
      mode: ["architect", "code", "bobshell"],
      tasks: BOB_TASKS.map((t, i) => ({
        id: t.id,
        label: t.label,
        status: "done",
        timeMs: [18200, 22400, 14100, 31000, 19300][i],
      })),
      filesScanned: 4248,
      totalTimeMs: 105000,
    }, null, 2),
  },
};
