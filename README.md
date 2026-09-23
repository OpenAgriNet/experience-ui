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

Requires [Node](https://nodejs.org) 20 or newer.

```bash
npm install
npm run dev      # http://localhost:3000
```

No environment variables are required to boot. The app calls `/api/*` on its
own origin.

There is no Experience API yet, so the client ships with a stub layer turned on
(`stubs.enabled` in `config.json`). With it on, every endpoint returns canned
data, nothing leaves the browser, and the chat works end to end — each reply is
labelled as stubbed so fabricated agricultural advice cannot be mistaken for
real. Set `stubs.enabled` to `false` to talk to a real backend. See
[`src/lib/api-stubs.ts`](src/lib/api-stubs.ts).

## Git hooks

The hooks live in `.husky/` and are activated by a single local git setting,
`core.hooksPath`. Installing dependencies sets it, because `package.json` runs
`husky` from its `prepare` script:

```bash
npm install
```

Check that yours are actually active:

```bash
git config core.hooksPath      # should print .husky/_
```

If that prints nothing, the hooks are not running. Fix it with `npx husky`.
This is worth checking rather than assuming: `core.hooksPath` is local to your
clone and is not committed, so anyone who installed dependencies before a hook
existed silently has no hooks.

| Hook | Runs |
|---|---|
| `pre-commit` | lint, typecheck, knip, tests |
| `commit-msg` | checks the subject against the convention in [`CONVENTIONS.md`](CONVENTIONS.md) |

Hooks are fast feedback, not the gate — they can be skipped with
`--no-verify`, so CI runs the same checks.

## Deployment

The image is a static build served by nginx. It expects to sit behind something
else — a reverse proxy terminating TLS and handling access control — and does
nothing about either itself.

```bash
docker compose up --build        # http://localhost:8080
```

or without compose:

```bash
docker build -t experience-ui .
docker run -p 8080:8080 experience-ui
```

`GET /healthz` returns `ok` for whatever is in front.

### Configuring a deployment

Everything a deployment changes — name, logo, favicon, colours, which features
are on, whether stubs are enabled — lives in `config.json`, read at boot and
applied without a rebuild. The image ships a default, so an unconfigured
container runs.

To override it, mount a **directory** containing `config.json` at
`/etc/experience-ui`:

```bash
docker run -p 8080:8080 -v "$PWD/my-config:/etc/experience-ui:ro" experience-ui
```

`docker-compose.yml` has the same mount commented out — uncomment it once the
directory exists. It is left off by default because an empty or missing
directory would shadow the config the image ships with.

```yaml
# Kubernetes
volumeMounts:
  - name: config
    mountPath: /etc/experience-ui
volumes:
  - name: config
    configMap:
      name: experience-ui-config    # with a config.json key
```

A directory rather than a single file, deliberately: single-file bind mounts
fail outright on some container runtimes, and a ConfigMap mounted with `subPath`
never sees later updates.

`config.json` is served with `Cache-Control: no-store`, so a changed
configuration takes effect on the next reload rather than whenever a cache
happens to expire. Content-hashed assets under `/assets/` are cached for a year;
`index.html` is not cached, because it names those assets.

## Documentation

| Doc | Contents |
| --- | --- |
| [`docs/ADR/`](docs/ADR/) | Accepted architecture decisions |
| [`AGENTS.md`](AGENTS.md) | What this repo is, its stack, layout, testing patterns and gotchas |
| [`CONVENTIONS.md`](CONVENTIONS.md) | Naming, git workflow, commit format, linting |

## License

MIT — see [`LICENSE`](LICENSE). The upstream copyright notice is retained as
that license requires.
