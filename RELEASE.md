# Releasing essai

essai uses [changesets](https://github.com/changesets/changesets) to manage
versions and changelogs across the monorepo. Only two packages are published:

- `@essai/core` — `packages/core`
- `essai` — `packages/cli` (the `essai` binary)

`@essai/web` and `@essai/tui` are private and never published.

## Workflow

### 1. Document a change

Any time you land user-visible work in `core` or `cli`, add a changeset:

```bash
pnpm changeset
```

Pick the affected package(s), choose bump type (`patch` / `minor` / `major`),
write a one-line summary. The file lands under `.changeset/`.

### 2. Roll up a release

When ready to cut a version:

```bash
pnpm version
```

This consumes pending changesets, bumps `package.json` versions, updates
`CHANGELOG.md`, and creates a `Version Packages` commit. Push it.

### 3. Publish

```bash
pnpm release
```

Runs `pnpm build`, then `changeset publish`. Requires `npm login` with
access to the `essai` and `@essai` scopes.

CI can do this automatically via the
[changesets/action](https://github.com/changesets/action) workflow; wire
`NPM_TOKEN` into repo secrets to enable.
