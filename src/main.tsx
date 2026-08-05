import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import './lib/i18n'
import App from './App.tsx'
import { useDemoDataStore } from './stores/useDemoDataStore'
import { applyEmptyStart } from './lib/api/demoData'

// `?empty=1` starts the demo with no data at all, so the whole lifecycle can be
// walked from scratch. Runs before the first render — never paint a seeded row.
applyEmptyStart()

/**
 * The E2E suite asserts against the demo database rather than scraping the DOM,
 * so it can tell "the mutation ran" apart from "the list happens to look right".
 * Dev/preview only — the client build never exposes it.
 */
if (import.meta.env.DEV) {
  ;(window as unknown as Record<string, unknown>).__demoStore = useDemoDataStore
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
