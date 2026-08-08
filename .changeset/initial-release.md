---
"@essai/core": minor
"essai": minor
"@essai/web": minor
"@essai/tui": minor
---

First public release of the essai writing framework.

- CLI: init, config (project + global), write (pipeline + raw + no-fix),
  rewrite (with .bak backup and restore-on-failure), read, list, status,
  context, review, export (md/plain txt), serve (Next.js web UI), tui (Ink)
- Bible: init templates (blank/romance/fantasy/mystery/scifi), AI agent
  dialog (--agent flag), validate, show, edit, add
- Validator: static continuity checks against bible/world.md
  (floor-consistency, forbidden-props, visa-duration)
- Auditor: LLM-driven 8-dimension continuity checks (audit command)
- Memory: per-chapter structured summary with events, emotions,
  foreshadowing, characterState, propsIntroduced/Used, timelinePosition,
  languageLevel
- Web UI: dashboard, chapter reader, AI review tab, Bible editor
- TUI: read-only browser (project picker → chapter/bible viewer)
- CI: GitHub Actions runs build · typecheck · lint · test on every push/PR
