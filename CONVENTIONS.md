# Conventions

Repo-wide conventions for naming, git workflow, and linting. Referenced from
`AGENTS.md`. Aligned with the other OAN repositories where the rule is not
language-specific.

## Naming Conventions

### TypeScript
| Artifact | Convention | Example |
|---|---|---|
| Component file | `kebab-case.tsx` | `chat-input.tsx` |
| Component | `PascalCase` | `ChatInput` |
| Hook | `useCamelCase` | `useChatStore` |
| Function | `camelCase` verb | `loadRuntimeConfig` |
| Constant | `UPPER_SNAKE_CASE` | `APP_NAME`, `FEATURES` |
| Type / interface | `PascalCase`, no `I` prefix | `AppConfig` |

### Configuration
- `config.json` keys are `camelCase`, matching the TypeScript that reads them.
- Feature flags are named for the capability, not the control: `voiceInput`,
  not `showMicButton`. The flag outlives the button.
- A flag is `true` or `false`. Anything else reads as off — deliberately, so a
  deployment writing `"true"` cannot enable a surface with no backend.

### Repository naming
kebab-case, specific to the capability. No `oan-` or `dpg-` prefix.

## Git Workflow

### Branch naming
`{type}/{issue-no}-{short-description}`, with the issue number where one exists.

```
feat/42-runtime-config
chore/devx
```

### Commit messages
`<type>: <summary in imperative mood> [#<issue-no>]`

The issue number makes commits grep-able: `git log --grep="#42"`. It is
encouraged but not required — a tooling change or a typo fix often has no issue,
and requiring one produces `[#0]`.

Scopes are optional. Don't define them speculatively.

| Type | When |
|---|---|
| feat | New capability |
| fix | Bug fix |
| refactor | No behaviour change |
| chore | Tooling, dependencies |
| test | Tests only |
| docs | Docs only |
| build | Packaging, the container image |
| ci | Workflows |
| perf | Performance, no behaviour change |

`.husky/commit-msg` enforces the subject line. To bypass deliberately:
`git commit --no-verify`.

**Add a body only when *why* is not obvious from the diff.** The subject is
usually the whole message. When a change turned on something surprising — a
coupling, a failure that would have been silent, a decision with a real
alternative — say so, because `git log` is where the next person looks. Long
design reasoning belongs in an ADR, not here.

### Pull requests
- Title follows the commit convention.
- Body says what changed, why, and how it was verified.
- End with `Relates to #<issue-no>` where an issue exists — it links without
  auto-closing on merge.

State what was actually run. "Verified by rendering the built image" and "should
work" are different claims and a reviewer cannot tell them apart afterwards.

## Linting & Formatting
- `eslint` for linting, `tsc -b` for types, `knip` for dead code.
- Formatting is **not** currently enforced. Prettier is installed but
  unconfigured; the codebase is tab-indented and Prettier defaults to spaces, so
  turning it on means either a matching config or a repo-wide reformat. Until
  that is decided, match the surrounding file.
- pre-commit runs lint, typecheck, knip and tests. Hooks can be bypassed with
  `--no-verify`, so CI runs the same checks and is the real gate.
- CI additionally runs the build, a route-tree freshness guard and a bundle
  budget.

## Dependencies
- **Bun only.** One lockfile, `bun.lock`. npm cannot resolve this tree.
- `bun install --frozen-lockfile` in CI, so a dependency added without
  committing the lockfile fails there rather than silently resolving to
  something else.
- A new dependency needs a reason in the commit body. This repo is a reference
  implementation; every dependency is one an adopter inherits.
