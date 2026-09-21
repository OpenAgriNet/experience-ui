# ADR-0000: Fork OAN-UI rather than build the reference client fresh

- **Status:** ACCEPTED
- **Date:** 2026-09-21
- **Deciders:** OAN (OpenAgriNet) DPG architecture group
- **Consulted:** DSS engineering; Experience Layer engineering
- **Informed:** Adopter engineering teams; OAN DPG steward

---

## 1. Context and Problem Statement

The Experience Layer needs a reference client: a neutral, configurable web
client that shows what the Experience API and DSS do, and serves as a worked
example for teams building their own.

OAN-UI is an existing OpenAgriNet client, MIT licensed, already speaking a
compatible backend shape. It solves most of what a reference client needs —
streaming chat, markdown rendering, language switching, voice and image
surfaces — and that work does not need doing twice.

**The question.** Do we build a reference client from scratch, use OAN-UI as it
stands, or fork it and adapt?

## 2. Decision Drivers

- **Reuse existing work.** The substance of a chat client already exists inside
  OpenAgriNet. Rebuilding it spends effort on solved problems.
- **A reference implementation must be configurable and unbranded.** It is the
  artifact adopters read to understand the contract. Shipping one tenant's logo,
  colours and copy makes it that tenant's app, not a reference.
- **We cannot push to OAN-UI.** It is an actively developed application with its
  own owners; the changes a reference client needs are not changes they asked
  for.
- **Provenance must survive.** This is a DPG. Whatever we ship has to show where
  it came from and on what terms.
- **Scope discipline.** A reference client that looks deployable gets forked by
  adopters, and the project then owns N clients.

## 3. Considered Options

**A. Build fresh.** Produces exactly the artifact wanted, carrying no tenant
identity and no inherited debt. Rebuilds a great deal that already works —
the streaming reader, markdown rendering, language handling and voice surface
are all solved in OAN-UI.

**B. Use OAN-UI as it stands.** No work at all, but it is not a reference
implementation: it presents as one tenant throughout, and its branding, auth
and configuration are fixed at build time rather than configurable.

**C. Fork OAN-UI and adapt.** Keeps the working client and makes the branding,
auth and configuration seams the first piece of work. Costs: we take on a
codebase we did not write, including its debt, and we own a divergence from
upstream.

## 4. Decision Outcome

**Chosen: option C** — fork `OpenAgriNet/OAN-UI` at `bh-main` `50aa452`
(2026-08-12), MIT.

It reuses the work that already exists and spends our effort on what is actually
missing: configurability and neutrality.

Three conditions make this a fork rather than a copy:

1. **Full upstream history is preserved** and the fork point is tagged
   `fork-point`, so `git diff fork-point..main` shows precisely what we changed
   and upstream authorship is never in question.
2. **Attribution is in place before any refactoring** — `LICENSE` retains the
   upstream copyright line as MIT requires.
3. **The inherited debt is written down, not discovered** — catalogued in
   §6 below, surveyed at the fork point before any refactoring.

### 4.1 Why conditions 1–3 are load-bearing

OpenAgriNet has one prior fork: `knowledge-provider`, derived from
`document-ingestion-pipeline`. Its code was copied into a fresh repository
rather than forked, so no `parent`, no shared commit, no `upstream` remote and
no attribution file exist. Establishing what it derives from took direct
knowledge from someone who was there — it is not recoverable from the
repository. And because the upstream is MIT while the derivative carries no
LICENSE at all, MIT's single condition (retain the copyright and permission
notice) is currently unmet.

That is the failure mode these three conditions exist to prevent. It costs about
an hour at fork time and cannot be reconstructed later.

## 5. Consequences

**Good**

- A working streaming client from the start; effort goes to what is missing.
- The refactor order is forced in a useful direction: configuration and branding
  seams first, because nothing can be demonstrated until they exist.
- `git diff fork-point..main` is a permanent, honest record of our divergence.
- Upstream fixes remain cherry-pickable if we ever want them (no `upstream`
  remote is configured today; adding one costs nothing later).

**Bad, and accepted**

- We inherit a codebase we did not write, with 19 catalogued debt items.
- We own a permanent divergence. This is a **hard fork**: no commitment to merge
  back, and upstream is under no obligation to accept anything.
- The client carries a starter-template lineage (TanStack Router boilerplate)
  whose structure was chosen for admin dashboards, not this.
- **Scope-discipline risk.** A polished reference client invites adopters to fork
  and ship it. The only controls are the README's "what this is not" section and
  consistent messaging. There is no technical enforcement, and this risk does
  not decrease over time.

**Revisit if**

- The reference client outgrows the inherited structure enough that rewriting
  costs less than carrying it.
- Adopters begin deploying this repository as a product, in which case scope
  discipline has failed and needs a stronger control than a README.

---

## 6. What we inherited

Surveyed at `50aa452` before any refactoring, so that the starting position is a
record rather than something later archaeology has to reconstruct. This is a
snapshot, not a task list — remediation is tracked in the issue tracker, and
this section is not updated as items are fixed.

Upstream is a production tenant application and was never required to be
configurable or unbranded. Every item below is a reasonable choice there and a
problem here.

### 6.1 Blocking a neutral deployment

| Finding | Location |
|---|---|
| **RSA public key hardcoded in source.** A PEM template literal, verified with `jose.jwtVerify`. Any token not signed by bharat-oan-api's private key fails, `user` stays `null`, and the app renders a lock screen. No runtime override exists — not in `public/`, not via env. Identical on `bh-dev`, so no branch avoids it. | `src/contexts/AuthContext.tsx:78-86` |
| **Configuration is build-time, not runtime.** `config.json` is statically imported, so Vite inlines it into a content-hashed bundle. `src/styles/global.css:26` reads *"Palette tokens driven by config.json"* — the intent was runtime configuration; the implementation never got there. | `src/hooks/ConfigProvider.tsx:2`, `src/components/screens-component/chat-screen/config.ts:1` |
| **Vite env vars bake at build time**, and the Dockerfile has no entrypoint script (`CMD ["nginx", "-g", "daemon off;"]`). Nothing substitutes values at container start, so "deployed as-is" and "configured via `.env`" are mutually exclusive. | `Dockerfile` |

### 6.2 Tenant branding

| Finding | Location |
|---|---|
| Logo path hardcoded to `/maha-logo.svg` | `src/components/screens-component/layouts/chat-header.tsx:7` |
| `<title>Bharat-VISTAAR</title>` and favicon in static HTML, outside React and outside config | `index.html` |
| **Two parallel string systems, both build-time.** `config.json` → `languageTexts` (10 languages) *and* `translations/*.json` (10 files, statically imported). All 10 translation files carry VISTAAR brand strings. Neutralizing copy means both systems, 20 files. | `config.json`, `translations/`, `src/components/LanguageProvider.tsx:2-11` |
| `notificationApiUrl` defaults to `https://registry-vistaar.da.gov.in/notification-api` — a cross-origin call to a tenant government host on every page load. Failure is swallowed, so it is not user-visible, but it should not fire at all. | `src/lib/config/environment.ts:3` |

### 6.3 Client/backend contract

| Finding | Location |
|---|---|
| **The user's question travels in a URL query string** (`GET /api/chat/?query=...`). It lands in access logs, browser history and referrer headers, and is capped by proxy URL limits. Should be a POST body. | `src/lib/api-service.ts` |
| **Image analysis is triggered by a magic string.** Upload returns an `image_id`, then the client sends the literal text `please do the pest analysis for this image <id>` as an ordinary chat query for the backend to string-match. The DSS contract defines a typed image content item for this. | `src/lib/api-service.ts:445` |
| `apiUrl` is a hardcoded empty string; all calls are root-relative. Not wrong — it makes the client same-origin by construction — but there is *no* configuration point for the backend URL, and routing `/api` is therefore an ingress concern. | `src/lib/config/environment.ts:2` |
| `nginx.conf` has no `/api` proxy (`try_files $uri $uri/ /index.html` only). On its own the container answers `/api/chat/` with `index.html` at HTTP 200 — HTML where JSON is expected. Something in front of the container does the split. | `nginx.conf` |

### 6.4 Repository hygiene

| Finding | Location |
|---|---|
| `package.json` is `"name": "react-boilerplate"`, `"version": "0.0.0"`, with no `license` field — tooling and SBOM scanners see an unlicensed boilerplate | `package.json` |
| README is the untouched starter template ("React + TanStack Router Starter… for large, scalable admin dashboards"). It never described OAN-UI. | `README.md` |
| **`chatBotIcon.svg` is 8.3 MB** and ships to every user on first load. `maha-logo.svg` is a further 124 KB. | `public/` |
| **Two lockfiles**: `bun.lock` (221 KB) and `package-lock.json` (314 KB). README mandates Bun; the Dockerfile runs `rm -f package-lock.json && npm install --legacy-peer-deps --force`. Three package-manager stories in one repo. | root, `Dockerfile` |
| **`VITE_API_URL` is dead.** The build workflow passes it in; it is referenced nowhere in `src/`. Someone wired the pipeline for a variable the code never reads — people may believe it works. | `.github/workflows/build.yml:53` |
| Env guards commented out, so missing configuration fails silently at runtime rather than loudly at boot | `src/config/env.ts:16-17` |
| `CODEOWNERS` still assigns OAN-UI's owners (`* @shashank-kenpath @digpalsinghk`, *"ownership for OAN-UI"*). PR governance in this repo gates on people who do not own it. | `.github/CODEOWNERS` |
| `desgin/desgin.xml` — misspelled directory | `desgin/` |

### 6.5 Deliberate upstream choices we are keeping

Not debt. Recorded so they are not "cleaned up" by someone who assumes otherwise.

- **Streaming via `fetch` + `ReadableStream`** rather than `EventSource` — correct,
  because `EventSource` cannot POST. This is the most delicate code in the
  client and it works.
- **`react-markdown` + `remark-gfm`** for answer rendering, with links forced to
  `target="_blank" rel="noopener noreferrer"`. Means the Experience API can
  append provenance as markdown and have it render safely today.
- **Same-origin `/api/*`** — no CORS, no preflight, by construction.
