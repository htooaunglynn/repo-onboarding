# 🧊 Repo Onboarding Assistant

### Understand any codebase in under 2 minutes — powered by **HAL**

A Next.js app with a **Liquid Glass** UI that points HAL at any repository — GitHub *or* a local folder — and generates a complete onboarding package: README, architecture diagram, plain-English walkthrough, and security scan.

> Built for the **HAL Hackathon 2026** · Theme: *Turn idea into impact faster*

---

## ✨ Features

- **Two input modes** — analyze a public/private GitHub repo by URL, or drop a local folder (code never leaves your machine)
- **Liquid Glass UI** — frosted-glass surfaces, animated aurora background, refractive depth
- **5 Bob tasks, fully automated** — scan → README → architecture diagram → summary → security scan
- **Live Mermaid diagrams** rendered in-browser
- **Bob session report** export — proof of meaningful Bob usage for submission
- **One-click downloads** for every generated artifact

---

## 🤖 How HAL Powers This

Bob is the engine behind every output. The app builds a full-repository context bundle and runs Bob through a **BobShell recipe** (`bob/onboard-repo.recipe`) with 5 sequential tasks:

| Task | Bob Mode | Output |
|------|----------|--------|
| Clone & full context scan | Architect | structured repo analysis |
| Generate README | Code | `README.md` |
| Architecture diagram | Architect | `architecture.mmd` |
| Plain-English summary | Architect | `onboarding-summary.md` |
| Security scan (Semgrep) | Code | `security-report.md` |

Every run exports a `bob-session-report.json` audit log.

---

## 🚀 Getting Started

```bash
# 1. Install
npm install

# 2. Run the dev server
npm run dev

# 3. Open http://localhost:3000
```

### Analyze a local repo from the CLI

```bash
npm run onboard -- --path /path/to/your/project
```

### Environment (optional)

Copy `.env.example` to `.env` and add a `GITHUB_TOKEN` if you want to analyze **private** GitHub repos.

> **Note:** The app ships in **demo mode** — it shows a pre-baked analysis of `vercel/next.js` so judges can see the full flow without Bob installed. To wire up real Bob, install the Bob CLI and uncomment the production fetch block in `app/page.js` (`runAnalysis`).

---

## 🏗️ Tech Stack

- **Next.js 14** (App Router)
- **React 18**
- **HAL** + BobShell (analysis engine)
- **Mermaid** (diagram rendering)
- Pure CSS Liquid Glass design system (no UI framework)

---

## 📁 Structure

```
app/
├── page.js                    # Main UI (landing → analyze → dashboard)
├── layout.js                  # Aurora + grain background
├── globals.css                # Liquid Glass design system
└── api/
    ├── onboard-local/route.js   # Local folder → Bob
    └── onboard-github/route.js  # GitHub repo → Bob
components/ui.js                # CodeBlock, FileTree, Mermaid, BobProgress
lib/
├── utils.js                   # Constants + helpers
└── demoData.js                # Pre-baked demo analysis
bob/onboard-repo.recipe        # BobShell workflow definition
cli/onboard-local.js           # Standalone local CLI
```

---

## 📜 License

MIT
