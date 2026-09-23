# ADR-0000: Fork OAN-UI rather than build the reference client fresh

- **Status:** ACCEPTED
- **Date:** 2026-09-21
- **Deciders:** OAN (OpenAgriNet) DPG architecture group
- **Consulted:** DSS engineering; Experience Layer engineering
- **Informed:** Adopter engineering teams; OAN DPG steward

---

## 1. Context and Problem Statement

The DSS answers agricultural questions. Nothing in it faces a person: it takes a
turn and answers it, holding no users, no sessions, no history and no interface.
**This repository is that interface** — the screen through which the DSS's
capability reaches someone who wants to use it.

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
3. **The starting position is recorded, not reconstructed later** — the fork
   point was surveyed before any refactoring, so what we began with is a matter
   of record rather than of memory. Summarised in §7.

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

- We inherit a codebase we did not write, and its accumulated decisions with it.
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

## 6. Where the client stands today

The fork kept a working chat client and the surfaces around it. What each part
is doing right now:

### 6.1 Working

| Feature | Notes |
|---|---|
| **Streaming chat** | The client sends the turn to the Experience API as `POST /v1/chat` and reads the answer back as a stream of events. A stub layer (`stubs.enabled`) can stand in for the API during development and speaks the same stream; it is off by default |
| **Markdown answers** | `react-markdown` + `remark-gfm`, with links forced to `target="_blank" rel="noopener noreferrer"` |
| **Copy an answer** | Client-side |
| **Retry a failed answer** | Client-side |
| **Light and dark theme** | Client-side |
| **Location** | The browser is asked once for the user's coordinates, which are attached to each chat request. A denied prompt is a normal outcome: the request is sent without them |
| **Runtime configuration** | Brand, theme and the flags below are read from `/config.json` at boot and can be changed on a running deployment without a rebuild |

### 6.2 Retained and switched off

Each of these is implemented and has a stub standing in for its endpoint. None
is reachable, because nothing can serve it yet. They are off in configuration
rather than removed, so that enabling one when the capability arrives is a
configuration change rather than a rewrite.

| Feature | Waiting on |
|---|---|
| **Voice input** | Transcription in the Experience API |
| **Spoken answers** | Text-to-speech in the Experience API |
| **Image questions** | The DSS image content item, and upload in the Experience API |
| **Follow-up suggestions** | A suggestions endpoint |
| **Languages other than English** | A DSS that answers in them. The client is pinned to English; the other nine remain in the translation files |

### 6.3 The rule this expresses

A control is shown only when it can do something. A surface with no capability
behind it is switched off rather than left present and inert — a client that
appears to offer a feature it cannot deliver misrepresents the platform it
exists to demonstrate.

This also sets which stubs are worth having. A canned response earns its place
where the point is to exercise the surface with dummy data, which is true of
chat and of nothing else. Everywhere else a flag is enough, and a stub as well
would be redundant.

---

## 7. What we started from

The fork point was surveyed at `50aa452` before any refactoring. What it found,
in summary: configuration was baked in at build time despite the code reading as
though it were not, branding was hardcoded across source, static HTML and ten
translation files, and a tenant's public key was compiled into the bundle, so a
token it did not sign left the app on a lock screen.

None of that survives. Configuration is fetched at boot and can be changed on a
running deployment; branding is part of it; identity is a single seam that
prescribes no method. §6 describes what the client is now, and
`git diff fork-point..main` is the full record of how it got there.

Each of those was a reasonable choice in a production tenant application, which
was never required to be configurable or unbranded. They are noted here because
the starting position is worth knowing, not as a list of complaints.

The client/backend contract is deliberately not recorded here. It changes with
the Experience API, and writing down a shape we are about to replace would only
mislead.

### 7.1 Deliberate upstream choices we are keeping

Not debt. Recorded so they are not "cleaned up" by someone who assumes otherwise.

- **Streaming via `fetch` + `ReadableStream`** rather than `EventSource` — correct,
  because `EventSource` cannot POST. This is the most delicate code in the
  client and it works.
- **`react-markdown` + `remark-gfm`** for answer rendering, with links forced to
  `target="_blank" rel="noopener noreferrer"`. Means the Experience API can
  append provenance as markdown and have it render safely today.
- **Same-origin API** — `api.baseUrl` in `config.json` is an absolute path
  on the app's own origin by default, so no CORS and no preflight. Another
  origin is possible, but needs CORS on the API and a wider CSP.
