# CLAUDE.md — SME Funding Management Platform (Frontend Demo)

Frontend-only demo (React + Vite + TS) of a funding-program management platform for women entrepreneurs.
Goal: win the client. No backend — static fixtures + simulated network. Arabic-first (RTL) + English.

## 🗺️ Context protocol (MANDATORY — designed to keep context small)

1. **Never read `docs/business/*`** (full PRD/Spec — human-only, large; a hook will block you).
2. For ANY task: read `docs/map/INDEX.md` first → it tells you exactly which ONE module file
   and which foundation files to load. Load ONLY those. Module files repeat cross-module contracts
   inline, so one module + its listed foundation files is enough for almost every task.
3. Shared contracts live in code as single sources of truth — prefer reading these small files over docs
   when you only need a type/enum: `src/data/types.ts`, `src/data/statusFlow.ts`, `src/lib/api/`, `src/index.css` (tokens).
4. Before implementing, open `docs/FEATURES.md`, find your item(s). After implementing AND verifying
   in the browser (AR + EN + dark mode), tick `[x]`.
5. **Business content is frozen.** Never change scope/wording in `docs/` (statuses, criteria, KPIs, modules)
   unless the user explicitly asks. If you edit any `docs/map/` file on user request, run `bash docs/build-spec.sh`
   to regenerate the human spec, and mirror business-level changes into `docs/business/PRD.md` is human work — flag it instead.

## 🤖 Model roles (enforce when delegating / choosing executors)

- **Fable** — planning, orchestration, business docs, task breakdown. **Does NOT write app code.**
- **Opus** — implements features (anything with logic: workflow engine, scoring, DataTable, GSAP morph, i18n plumbing).
- **Sonnet** — low-risk mechanical code only: fixtures data entry, locale JSON, simple presentational
  components from an exact spec, adding shadcn components, copy changes.
- Subagents in `.claude/agents/`: `planner` (fable), `feature-dev` (opus), `ui-dev` (sonnet), `qa-reviewer` (opus).
  Typical flow: planner produces a task card (module file refs + acceptance criteria) → feature-dev/ui-dev implement → qa-reviewer verifies → tick FEATURES.md.

## Task-card format (planner → developer)

```
TASK: F4.2 Schedule dialog
READ: docs/map/modules/04-interviews.md · docs/map/foundation/data-model.md (Interview shape)
TOUCH: src/features/interviews/* , src/lib/api/interviews.ts
DEPENDS: F0.4 (types), F0.5 (api layer), F2.3 (status transition)
DONE WHEN: acceptance criteria in module doc §Schedule dialog + FEATURES item ticked
```

## Hard rules

- Tailwind logical properties only (`ms-/me-/ps-/pe-/start-/end-`) — never `ml/mr/pl/pr` (RTL).
- Every user-facing string through i18next (`ar.json` + `en.json`) — no hardcoded copy.
- Icons: custom SVG paths through `MorphIcon` (GSAP). GSAP = SVG morph only; Framer Motion = everything else.
- Data mutations only via simulated API hooks → `useDemoDataStore`; never mutate the store from components.
- Statuses: use the 8-value `ApplicationStatus` enum + `statusFlow.ts` transitions. Never invent statuses.
- No new deps without asking. No backend calls. Deterministic fixtures (no top-level `Math.random()`).

## Commands

- `npm run dev` · `npm run build` (tsc + vite — must pass before ticking any feature) · `npm run lint`
- `npx shadcn@latest add <component>` for new primitives.
- `bash docs/build-spec.sh` — regenerate human spec after (user-approved) map edits.
