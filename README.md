# SME Funding Management Platform — Frontend Demo

A frontend-only demo of a funding-program management platform for
entrepreneurs: online application, automated screening & scoring, interviews,
contracts with e-signature, disbursement, and post-funding monitoring.
Arabic-first (full RTL) with an English switch, light & dark themes.

**No backend.** Everything runs on deterministic in-memory fixtures behind a
simulated API layer — which also means **a page reload resets the data**.

## Quick start

```bash
npm install
npm run dev
```

▶ **[docs/DEMO.md](docs/DEMO.md)** (العربية: [docs/DEMO.ar.md](docs/DEMO.ar.md)) —
the step-by-step happy-scenario walkthrough (applicant submits → screening → interview → approval → contract &
e-signature → disbursement → follow-up report). Demo OTP for signing: `1234`.

## What's inside

| Area | Route(s) |
|---|---|
| Applicant portal — landing, 5-step apply wizard, tracking, contracts, follow-up form | `/`, `/apply`, `/track`, `/my-applications`, `/my-contracts`, `/follow-up/:id` |
| Admin — dashboard, applications workflow, interviews, contracts, disbursements, monitoring, reports, settings | `/admin/*` |

- **Workflow engine** — 8-status lifecycle with a validated transition table
  (`src/data/statusFlow.ts`); illegal moves are impossible from the UI.
- **Scoring** — criteria-weighted auto-screening with per-criterion breakdown.
- **E-signature** — bilingual generated contract, signature pad, OTP step.
- **Notifications** — simulated SMS / WhatsApp / email with phone-frame
  previews and a ringing bell.
- **i18n** — every string through i18next (`ar` / `en`), logical CSS
  properties throughout for RTL.

## Stack

React 19 · TypeScript · Vite · Tailwind (v4, logical properties) · shadcn/ui ·
TanStack Query + Zustand (simulated API & store) · Framer Motion + GSAP (SVG
morph icons) · i18next · Playwright e2e.

## Scripts

```bash
npm run dev        # start the demo
npm run build      # typecheck + production build
npm run lint       # oxlint
npx playwright test  # full e2e suite (includes the lifecycle dry-run)
```
