# Foundation — Icon System (GSAP path morph) & Animation

## Icon system (`src/components/icons/`)

Every app icon (nav, status, actions) is a **custom inline SVG with raw `<path d>` data** so GSAP can
morph between states. Do NOT use lucide components for these (lucide is only a fallback inside shadcn primitives).

### Contract

```tsx
// MorphIcon.tsx — the single engine component
interface MorphIconProps {
  paths: { idle: string; active: string };  // same number of points preferred
  active?: boolean;      // morphs to active shape + accent color when true (e.g. current nav route)
  size?: number;         // default 20
  strokeWidth?: number;  // default 1.8; icons are stroke-based, fill="none", viewBox 0 0 24 24
  className?: string;
}
```

- Engine: `gsap` + `MorphSVGPlugin` (free since GSAP 3.13 — `import { MorphSVGPlugin } from 'gsap/MorphSVGPlugin'`, register once in `src/lib/gsap.ts`).
- Behavior: on `hover` → morph idle→active (0.35s, `power2.out`) and back on leave;
  when `active` prop is true → stay morphed (skip hover reversal).
- Each concrete icon is a thin wrapper exporting its two path sets:
  `HomeIcon, ApplicationsIcon, InterviewIcon, ContractIcon, DisbursementIcon, FollowUpIcon,
  ReportsIcon, SettingsIcon, BellIcon, UserIcon, SearchIcon, MoonSunIcon (theme toggle morphs moon↔sun),
  LangIcon, CheckIcon, XIcon, ClockIcon, DocumentIcon, UploadIcon` — status icons for `StatusBadge` too.
- Design idle/active pairs to be meaningfully different (e.g. bell → bell-ringing with waves;
  document → document-with-check). Author both paths with the same point count where possible for clean morphs.
- Respect `prefers-reduced-motion`: snap-swap paths instead of tweening.

## Framer Motion usage

- Route transitions, list stagger, KPI count-up, wizard step slide (direction-aware: RTL flips slide direction).
- Never animate the same element with both GSAP and Framer Motion.
- GSAP is ONLY for SVG path morphing; Framer Motion for everything else.
