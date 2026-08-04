# Foundation — State Management (zustand)

Server-ish data lives in TanStack Query (see `data-model.md`). Zustand holds **client/UI state + the demo's in-memory "database"**.

## Stores (`src/stores/`)

| Store | State | Notes |
|---|---|---|
| `useDemoDataStore` | `applications, interviews, contracts, disbursements, followUps, notifications` + mutator actions (`updateStatus`, `addApplication`, `scheduleInterview`, `signContract`, `issueDisbursement`, `submitFollowUp`, `pushNotification`) | Initialized from fixtures. The simulated API reads/writes here. Every mutator also appends a `TimelineEvent` and auto-creates the matching `AppNotification` (see module 09). |
| `useUiStore` | `theme ('light'|'dark')`, `lang ('ar'|'en')`, `sidebarCollapsed` | theme+lang persisted (zustand `persist`, localStorage) |
| `useApplyWizardStore` | current step, draft form values per step | lets the wizard survive step navigation; cleared on submit |
| `useSettingsStore` | scoring criteria weights (editable in admin settings), notification template toggles | demo of "customizable criteria" |

## Rules

- Components never mutate `useDemoDataStore` directly — always through the simulated API mutation hooks
  (`src/lib/api/*`), so TanStack Query invalidation stays correct and latency is simulated.
- Selectors: subscribe narrowly (`useDemoDataStore(s => s.applications)`) to avoid re-renders.
- No data persistence across reloads (fresh demo each load) — only theme/lang persist.
