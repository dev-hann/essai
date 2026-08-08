# Contributing to essai

essai welcomes contributions of all sizes — bug reports, fixes, new
craft rules, templates, validator dimensions, UI polish, docs.

## Quick contribution flow

1. **Open an issue first** for anything beyond a typo fix. A 30-second
   "I'm planning to do X, here's my approach" issue saves everyone time
   and avoids duplicate work.
2. Fork → branch off `main` → commit.
3. Add a changeset (see below).
4. Run `pnpm build && pnpm lint && pnpm test`. They must be green.
5. Open a PR. CI runs the same gate; merge once it's green.

## Repository layout

```
essai/
├── packages/
│   ├── core/   — pure TS, no UI. The library both CLI and Web call.
│   ├── cli/    — Commander.js entrypoint. `essai` binary.
│   ├── tui/    — Ink 7 + React 19. `essai tui` browser.
│   └── web/    — Next.js 15 app router. `essai serve`.
├── templates/  — Bible templates (blank/romance/fantasy/mystery/scifi)
├── docs/       — design.md, web-ui.md, validation-future-work.md
└── .changeset/ — version management
```

Work that touches the writing pipeline or memory shape almost always
lives in `packages/core`. The CLI/TUI/Web layers are thin shells that
call into core.

## Setup

```bash
git clone …
cd essai
pnpm install
pnpm build
pnpm test
```

Requires Node ≥ 22 and pnpm 9.15.x (enforced via `packageManager`).
The CI workflow runs on Ubuntu with Node 22.

## Common tasks

### Add a craft rule

1. Add the rule to `CRAFT_RULES` in `packages/core/src/llm/craft-rules.ts`.
2. If it's an AI-tell word/phrase, extend `AI_TELLS_EN` / `AI_TELLS_KO`
   in `packages/core/src/reviewer/ai-tells.ts`.
3. Add a snapshot test (`craft-rules.test.ts`) and a detect-AI-tell test.
4. Update `docs/design.md` §9 if the rule changes the documented set.

### Add a validator dimension

The static validator (`packages/core/src/validator/static-validator.ts`)
handles deterministic checks. The LLM auditor (`continuity-auditor.ts`)
handles semantic checks. To add one:

- **Static:** push a new entry to `VALIDATION_RULES`, write a test in
  `static-validator.test.ts`. Surface via `essai validate <chapter>`.
- **LLM:** push a new entry to `AUDIT_DIMENSIONS`, write a test in
  `continuity-auditor.test.ts` (mock `generateText`). Surface via
  `essai audit <chapter>`. Keep the prompt under 3 lines so per-call
  token cost stays predictable.

### Add a Bible template

1. Create `templates/<name>.md`. Frontmatter `agent.template` controls
   which sections the parser splits out.
2. Add the name to `TEMPLATE_NAMES` and `TemplateName` in
   `packages/core/src/bible/templates.ts`.
3. Update CLI help text in `packages/cli/src/index.ts`.
4. Add a `templates.test.ts` case.

### Change the memory schema

The memory JSON shape is forward-only compatible: every new field must
have a zod default so older chapter memory files keep loading. See
`packages/core/src/memory/types.ts` and the regression test in
`types.test.ts` titled "fills defaults for the new memory fields when
omitted".

## Changesets

Every PR that changes published packages (`@essai/core`, `essai`,
`@essai/web`, `@essai/tui`) needs a changeset:

```bash
pnpm changeset
```

Pick the affected package(s), choose bump type, write a one-line
summary. CI opens a "Version Packages" PR after merge; merging that PR
publishes to npm automatically (once `NPM_TOKEN` is configured).

| Bump type | When |
|-----------|------|
| patch | bugfix, no API change |
| minor | new feature, backwards-compatible |
| major | breaking change (rare) |

## Coding conventions

- TypeScript strict + `exactOptionalPropertyTypes` + `noUncheckedIndexedAccess`.
- Lint via Biome (`pnpm lint`). Auto-fixable issues can be applied with
  `pnpm exec biome check --write .`.
- Tests via Vitest. Every new module gets a sibling `<name>.test.ts`.
- No comments in code unless the "why" is non-obvious (the codebase
  already follows this — match it).
- Korean is welcome in user-facing strings (CLI output, web UI copy,
  docs). Code identifiers, comments, and commit messages stay English.

## Release process

See [`RELEASE.md`](./RELEASE.md). Maintainers cut versions by merging
the auto-generated "Version Packages" PR; CI handles the actual publish.

## Code of conduct

Be kind. Disagree about code, not people. Harassment of any kind is not
welcome and will result in a permanent ban from the project.
