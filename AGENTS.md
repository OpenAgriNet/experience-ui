# experience-ui

## Service Overview
The reference web client for the OpenAgriNet (OAN) **Experience Layer**. The DSS
answers agricultural questions and holds no interface of its own; this is the
screen its capability reaches a person through. It talks to the Experience API,
which calls the DSS. It is meant to be read and copied by adopters, not deployed
as a product.

## Architecture & decision reference
Do not duplicate architecture or decision detail here — it goes stale
immediately. The authoritative sources are:
- **`docs/ADR/`** — accepted architecture decisions. `0000-fork-oan-ui.md` covers
  why this is a fork of OAN-UI, what the client is today, which features are
  switched off and what each is waiting on.

**Write an ADR for new tech-stack or design-direction decisions.** Any choice
with real trade-offs — a framework, a state library, an API shape, how identity
is carried — gets a new `docs/ADR/NNNN-title.md` in the existing format
(context, decision drivers, considered options, decision outcome, consequences).
Don't make load-bearing decisions silently in code or a PR description.

**Keep ADR-0000 §6 current.** It lists what works and what is switched off. When
a feature flag flips, update it in the same change.

## Tech Stack
- Language: TypeScript
- UI: React 19, Vite
- Routing: TanStack Router, virtual file routes (`src/routes.ts`)
- State: Zustand
- Styling: Tailwind CSS v4, shadcn/ui components in `src/components/ui`
- Runtime and package manager: **Node 24 and npm.** One lockfile,
  `package-lock.json`. Nothing runs a JavaScript runtime in production — the
  deployed artifact is static files served by nginx
- Tests: Vitest, with happy-dom where a test needs a real `document`
- Dead code: knip
- Serving: nginx in a container (`Dockerfile`, `nginx.conf`)

## Build & Run
```
npm install              # also activates git hooks, via the prepare script
npm run dev              # http://localhost:3000
npm run lint             # eslint
npm run typecheck        # tsc -b
npm run knip             # dead files and dependency drift
npm test                 # vitest
npm run build            # tsc -b && vite build
docker compose up --build   # the deployable image, http://localhost:8080
```

There is no Experience API yet. The client ships with stubs on
(`stubs.enabled` in config), so chat works end to end with canned replies, each
labelled as stubbed.

## Conventions
Naming, git workflow, commit format, PR shape and linting are in
[`CONVENTIONS.md`](./CONVENTIONS.md). Read it before naming anything, writing a
commit, or opening a PR.

## Writing Style
Applies to ADRs, PR descriptions, code comments, and any other document.
- Simple words, short sentences.
- No verbosity — say only what's needed.
- Write for a non-technical reader — a product owner, anyone without a software
  background.

## Folder Structure

```
src/
├── main.tsx              # Entry. Loads config, applies branding, THEN dynamically
│                         # imports bootstrap. See the gotcha below — this order is
│                         # load-bearing.
├── bootstrap.tsx         # Mounts React. Anything reachable from here may read config
│                         # at import time.
├── routes.ts             # Virtual route definitions, read by vite.config.ts.
├── routeTree.gen.ts      # Generated AND committed. See gotchas.
│
├── config/               # app-config.json — the bundled default, and the file the
│                         # Vite plugin serves and emits as /config.json.
├── lib/
│   ├── config/           # runtime-config.ts (fetch + merge + getConfig),
│   │                     # features.ts (flags), branding.ts (title, favicon).
│   ├── auth/             # The identity seam. Returns a fixed local user and
│   │                     # verifies nothing. How a credential reaches the API is
│   │                     # deliberately undecided.
│   ├── api-service.ts    # The client's entire server coupling. One file.
│   └── api-stubs.ts      # Canned responses. Only chat is reachable today.
│
├── components/
│   ├── ui/               # shadcn/ui. Vendored, kept as a whole API — knip reports
│   │                     # its unused exports and the gate deliberately ignores them.
│   └── screens-component/
├── hooks/store/chat/     # The chat store. Zustand.
├── layouts/
└── __tests__/
```

## Testing Patterns
- Framework: Vitest. Tests live in `src/__tests__/`.
- Default environment is Node. A test needing a real `document` opts in with a
  `@vitest-environment happy-dom` docblock.
- **Test behaviour, not configuration.** A test asserting that a config file
  contains what the config file contains fails whenever a default legitimately
  changes and teaches people to ignore red. Two such tests were written and
  removed here; don't add more.
- What is worth a test: the coercion rules (anything other than boolean `true`
  reads as off), the config merge, the fallback when `config.json` is
  unreachable, and anything where storage and configuration disagree — the
  English pinning test exists because `localStorage` beating a flag is a real
  failure mode.

## Known Gotchas

- **`src/routes.ts` is loaded by `vite.config.ts` as a string path.** No static
  analysis reaches it. It is declared as a knip entry point for this reason;
  without that, knip calls it and `@tanstack/virtual-file-routes` dead.
- **`routeTree.gen.ts` is generated and committed.** The build regenerates it,
  so a diff after `npm run build` means it had drifted from `src/routes.ts`. CI
  guards this.
- **Configuration is read at module-init time**, so `main.tsx` loads config and
  then *dynamically* imports `bootstrap.tsx`. A static import would evaluate the
  whole graph first and `getConfig()` would throw. The `.then()` chain is not
  stylistic.
- **Assets in `public/` cannot be imported from JavaScript.** That is why
  `config.json` is emitted by a Vite plugin from `src/config/app-config.json`,
  so one file serves as both the bundled fallback and the deployment override.
- **`विस्तार` / `વિસ્તાર` is the ordinary word for *area*** in Hindi, Marathi and
  Gujarati. Find-and-replace on brand names corrupts legitimate copy. Read every
  occurrence.
- **Never reach for `--legacy-peer-deps`.** It hides real version conflicts —
  one was hiding behind it here, `@vitest/coverage-v8` pinned a minor behind
  `vitest`. If npm refuses to resolve something, the answer is an upgrade or
  pnpm, not the flag.
- **The router plugin needs Node.** `vite.config.ts` passes
  `virtualRouteConfig` as a path, so the generator loads that TypeScript file
  through `tsx`, a Node loader. Under Bun it failed with
  `Cannot find package 'tsx:'`, and only sometimes — depending on whether the
  generator's cache decided to re-run.
- **knip's unused-export list is not a task list.** `src/components/ui` is a
  vendored component kit kept whole. The gate covers files and dependencies only.
- **Verify with `npm run dev` as well as `npm run build`.** A Vite rule about
  `public/` imports once shipped in a PR that built and served correctly from
  `dist/` but broke the dev server.
