# Module 03 — Auto Screening & Scoring (الفرز والتقييم الآلي)

**Audience:** staff. **Surface:** Score tab in `/admin/applications/:id` + criteria config in `/admin/settings`.
**Load with:** `foundation/data-model.md`, `foundation/state-management.md`.

## Purpose
Automatic completeness check, eligibility rules, and a weighted score per applicant with
**customizable criteria weights**.

## Behaviors

### 1. Completeness check (runs on submit + on demand)
- All required fields present + all required document kinds uploaded + terms accepted.
- Fail → suggest `incomplete` status with the list of missing items (feeds module 02's transition dialog).

### 2. Eligibility rules (`src/features/scoring/eligibility.ts`)
Demo rules (pure functions, visible in UI as pass/fail checklist):
- Age of data: nationalId valid format · requestedAmount within 5k–200k ·
  monthlyIncome > 0 · experienceYears ≥ 0 · region within program coverage.
- Any hard-fail → verdict `ineligible` (UI shows which rule failed).

### 3. Weighted score (`ScoreCard` shape → data-model.md)
| Criterion key | Default weight |
|---|---|
| `income_stability` | 25 |
| `project_experience` | 20 |
| `seriousness` | 15 |
| `repayment_ability` | 25 |
| `data_completeness` | 15 |

- Each criterion scored 0–100 (deterministic demo formulas from application fields, e.g.
  experienceYears → project_experience curve). `total = Σ(weight% × value)`.
- Verdict: `total ≥ 70` eligible · `50–69` manual_review · `< 50` ineligible.
- Weights editable in `/admin/settings` (`useSettingsStore`); "Recalculate" button re-scores
  visibly (animated number + radar/bar breakdown chart).

### Score tab UI
- Big total gauge + verdict badge, criteria breakdown bars w/ weight chips, eligibility checklist,
  "Recalculate" + "Apply suggested status" (eligible → `under_review` fast-track hint).

## Acceptance criteria
- Changing weights in settings immediately changes recalculated totals (demo wow-moment).
- Scoring is deterministic — same input, same score.
