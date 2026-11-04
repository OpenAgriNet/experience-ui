# ADR-0001: Validate forms in the browser without `unsafe-eval`

- **Status:** ACCEPTED
- **Date:** 2026-11-03
---

## 1. Context and Problem Statement

The client draws DSS forms with RJSF. RJSF needs a validator. The one it ships,
`@rjsf/validator-ajv8`, is built on Ajv.

Ajv turns a schema into JavaScript text, then runs it with `new Function`. The
browser treats that like `eval`.

The container serves the client with a Content Security Policy of
`script-src 'self'`. That blocks `new Function`. The form draws, but submit
fails with "Error compiling schema". The Vite dev server sets no policy, so
this only shows in the container.

**The question.** Allow eval, or validate without it?

## 2. Decision Drivers

- The policy stops injected content from running as code. Loosening it for one
  library is a bad trade.
- Validation must stay in the browser, so the farmer sees a bad value before
  the form is sent.
- The DSS checks every submission again. The browser check is the fast path.

## 3. Considered Options

1. **Add `'unsafe-eval'` to the policy.** One line. Every script on the page
   may then run strings as code.
2. **Write our own validator.** No eval. We own the rules and must extend them
   for each new one.
3. **Use a validator that reads the schema instead of compiling it.**
   `@cfworker/json-schema` is made for places where eval is banned. A small
   adapter maps its errors to RJSF's shape.

## 4. Decision Outcome

Option 3. `src/lib/forms/validator.ts` implements RJSF's validator interface on
`@cfworker/json-schema`. Errors keep Ajv's shape, so the farmer messages in the
form view do not change.

`@rjsf/validator-ajv8` stays in `package.json`. RJSF core imports it for a test
helper without declaring it, so removing it breaks `@rjsf/core`. Nothing in
`src` uses it.

## 5. Consequences

- Forms submit under the strict policy. The policy is unchanged.
- The existing form view tests pass unchanged on the new validator.
- A new schema rule is checked by the library. No validator code changes.
- Ajv still ships in the form chunk, because of the RJSF core import.
- The adapter reads the missing field name from the library's message text. A
  test pins that text, so a library upgrade that changes it fails in CI.
