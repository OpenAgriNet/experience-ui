# experience-ui

Reference web client for the OpenAgriNet **Experience Layer**. It talks to the
Experience API, which in turn calls the [Decision Support System
(DSS)](https://github.com/OpenAgriNet/decision-support-system). Its job is to
make the DSS's capabilities *visible* — streamed answers, provenance, refusals,
and the non-answered outcomes — in a deployment that carries no adopter
branding.

> **Status: early.** Forked 2026-09, under active refactoring. Nothing here is
> stable yet. See [`docs/ADR/0000-fork-oan-ui.md`](docs/ADR/0000-fork-oan-ui.md)
> §6 for what came across from upstream.

## Lineage

This repository is a **hard fork of [OpenAgriNet/OAN-UI](https://github.com/OpenAgriNet/OAN-UI)**,
taken from branch `bh-main` at commit
[`50aa452`](https://github.com/OpenAgriNet/OAN-UI/commit/50aa452b36158a64721e810d59843e0523a49b2c)
(2026-08-12), MIT licensed. The complete upstream history is preserved here and
the fork point is tagged `fork-point`:

```bash
git log  fork-point..main    # everything this project changed
git diff fork-point..main
```

Upstream is a production tenant application. This repository exists because a
reference implementation needs to be configurable and unbranded, which that
application was never required to be. See
[`docs/ADR/0000-fork-oan-ui.md`](docs/ADR/0000-fork-oan-ui.md) for why we forked
rather than built fresh, and what that decision costs.

## What this is — and what it is not

**It is** a demonstration client: a neutral, configurable reference that shows
what the Experience API and DSS can do, and a worked example for teams building
their own client.

**It is not** a product, and it is not intended for adopters to deploy or fork
as their branded farmer-facing app. It carries no tenant data, no production
hardening, and no compatibility guarantees. Adopters should build their own
client against the Experience API contract and treat this as a reference, not a
starting point.

If you find yourself forking this to ship it, that is a signal the Experience
API contract needs better documentation — please open an issue instead.

## Quick start

Requires [Bun](https://bun.sh).

```bash
bun install
bun dev          # http://localhost:3000
```

No environment variables are required to boot. The app calls `/api/*` on its
own origin, so a local backend is wired through the Vite dev proxy rather than
configuration — see `vite.config.ts`.

## Documentation

| Doc | Contents |
| --- | --- |
| [`docs/ADR/`](docs/ADR/) | Accepted architecture decisions |

## License

MIT — see [`LICENSE`](LICENSE). The upstream copyright notice is retained as
that license requires.
