#!/usr/bin/env bash
# Regenerates docs/business/FUNCTIONAL_SPEC.md from docs/map/ (source of truth).
# Run from anywhere: bash docs/build-spec.sh
set -euo pipefail
cd "$(dirname "$0")"
{
  printf '# 📗 Functional Specification — SME Funding Management Platform (Demo)\n\n'
  printf '> **⚠️ HUMAN-ONLY DOCUMENT.** AI agents must NOT load this file (hook-enforced). AI agents use `docs/map/INDEX.md` + the per-module files instead.\n'
  printf '> This document is **assembled from** `docs/map/` (foundation + modules) — those files are the source of truth.\n'
  printf '> To regenerate after editing map files: `bash docs/build-spec.sh`\n\n'
  printf '**Version:** 1.0 · **Date:** %s\n\n---\n\n# Part A — Foundation\n\n' "$(date +%F)"
  for f in map/foundation/tech-stack.md map/foundation/design-system.md map/foundation/localization.md \
           map/foundation/data-model.md map/foundation/state-management.md map/foundation/icons-animation.md; do
    cat "$f"; printf '\n\n---\n\n'
  done
  printf '# Part B — Functional Modules\n\n'
  for f in map/modules/*.md; do cat "$f"; printf '\n\n---\n\n'; done
} > business/FUNCTIONAL_SPEC.md
echo "Rebuilt business/FUNCTIONAL_SPEC.md"
