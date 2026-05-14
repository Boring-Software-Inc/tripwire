# Tripwire monorepo: package extraction plan

Tripwire is now a pnpm + turborepo monorepo. The current TanStack Start app
lives at `apps/web`. Shared business logic still sits inside `apps/web/src`
and needs to be extracted into `packages/*` so the upcoming `apps/cli` (and
any future apps) can consume it without depending on the web app.

This document is the concrete extraction plan. Each phase is independently
shippable and leaves the app working.

## Current state

```
tripwire/
├── apps/
│   └── web/                    ← TanStack Start app (everything still lives here)
├── packages/                   ← empty
├── turbo.json
├── pnpm-workspace.yaml
├── tsconfig.base.json
└── package.json                ← workspace root
```

`apps/web/src` has these candidate boundaries:

- `db/` — Drizzle schema + types + connection
- `lib/auth.ts` — Better-Auth setup
- `lib/github/` — GitHub REST/GraphQL helpers
- `lib/events.ts` + `lib/reputation.ts` + `lib/rules/` — core business logic
- `lib/ai/contributor-score.ts` — pure scoring algorithm
- `lib/tools/` — tool registry + adapters (MCP + chat)
- `components/`, `lib/ai/ui-catalog.ts`, `lib/ai/ui-registry.tsx` — UI

## Target structure

```
packages/
├── db/             # @tripwire/db        — schema, connection, types
├── auth/           # @tripwire/auth      — Better-Auth instance + helpers
├── github/         # @tripwire/github    — REST/GraphQL helpers (no DB)
├── core/           # @tripwire/core      — events, reputation, rules, scoring
├── tools/          # @tripwire/tools     — tool registry + adapters
└── ui/             # @tripwire/ui        — design tokens + json-render
                                            catalog + registry + shared cards
```

## Dependency order (do them in this order)

```
db ──┬──> auth ──┐
     │           │
     ├──> github ┤
     │           │
     └──> core ──┴──> tools ──> [apps/web, apps/cli]
                                       │
                                       └── ui (consumed by apps/web only)
```

Reasoning:
- `db` has the schema. Everything that touches Postgres needs it.
- `auth` configures Better-Auth and pulls user/session models from `db`.
- `github` is pure API client code; takes a token, returns data. No DB.
- `core` wraps db queries with business logic: logEvent, reputation,
  contributor-score. Imports `db`, optionally `github` types.
- `tools` is the highest-level: imports `db`, `core`, `github`, `auth`.
  Both MCP server and AI chat consume it.
- `ui` is the visual layer — only the web app needs it (CLI doesn't render
  React).

## Per-package extraction

### Phase 1: `@tripwire/db`

**Move:**
- `apps/web/src/db/index.ts` → `packages/db/src/connection.ts`
- `apps/web/src/db/schema.ts` → `packages/db/src/schema.ts`
- `apps/web/drizzle/` → leave with web for now (migrations execute against
  one DB, owned by the app that boots; move later if multiple apps run
  migrations independently).

**Exports:**
```ts
// packages/db/src/index.ts
export * from "./schema";
export { db } from "./connection";
```

**Package config:**
```json
{
  "name": "@tripwire/db",
  "exports": { ".": "./src/index.ts" },
  "dependencies": {
    "drizzle-orm": "...",
    "pg": "..."
  },
  "peerDependencies": {
    "drizzle-kit": "..."
  }
}
```

**Migration in apps/web:**
- `#/db` → `@tripwire/db` (single find-replace)
- `#/db/schema` → `@tripwire/db`
- Drizzle config now reads schema from `../../packages/db/src/schema.ts`.

**Risk:** low. Schema is self-contained.

### Phase 2: `@tripwire/auth`

**Move:**
- `apps/web/src/lib/auth.ts` → `packages/auth/src/index.ts`

**Exports:**
- `auth` (Better-Auth instance)
- Plus the GitHub installation and Autumn plugin config it currently does.

**Tricky bit:** `lib/auth.ts` references autumn/billing and organization
management — those are app-level concerns that should stay configurable.
Pass them in via a factory:

```ts
// packages/auth/src/factory.ts
export function createAuth(opts: { autumn?: AutumnAdapter, ... }) { ... }
```

**Migration:** `#/lib/auth` → `@tripwire/auth`.

**Risk:** medium. Better-Auth has implicit context coupling to the request
handler — verify SSR flows still work.

### Phase 3: `@tripwire/github`

**Move:**
- `apps/web/src/lib/github/` → `packages/github/src/`

**Files:**
- `github-api.ts` (the main helpers)
- `filter-pipeline.ts` (if it's pure)
- All `*.test.ts`

**No DB dependency.** This is the cleanest package — pure HTTP client.

**Exports:** all the `getMergedPrCount`, `fetchUserGraphQL`, `getRepoContributors`,
etc. functions.

**Migration:** `#/lib/github/github-api` → `@tripwire/github`.

**Risk:** very low.

### Phase 4: `@tripwire/core`

**Move:**
- `apps/web/src/lib/events.ts` → `packages/core/src/events.ts`
- `apps/web/src/lib/reputation.ts` → `packages/core/src/reputation.ts`
- `apps/web/src/lib/rules/` → `packages/core/src/rules/`
- `apps/web/src/lib/ai/contributor-score.ts` → `packages/core/src/score.ts`

**Depends on:** `@tripwire/db` (for tables + types), `@tripwire/github` (for
`GitHubAchievement` / `GitHubUserGraphQL` types used by score).

**Exports:** `logEvent`, `logEvents`, `resetContributorScore`,
`computeContributorScore`, `normalizeRuleConfig`, `ruleConfigSchema`,
`getRuleConfigChanges`, etc.

**Migration:**
- `#/lib/events` → `@tripwire/core`
- `#/lib/reputation` → `@tripwire/core`
- `#/lib/rules/config-schema` → `@tripwire/core`
- `#/lib/rules/config-draft` → `@tripwire/core`
- `#/lib/ai/contributor-score` → `@tripwire/core`

**Risk:** medium. `events.ts` has implicit coupling to the request logger
(`evlog`). Decide whether `evlog` is a peer dep of `core` or whether logging
is injected.

### Phase 5: `@tripwire/tools`

**Move:**
- `apps/web/src/lib/tools/` → `packages/tools/src/`

**Already a well-bounded module.** Its deps:
- `@tripwire/db` (schema types)
- `@tripwire/core` (logEvent, rule helpers, reset, score)
- `@tripwire/github` (lookup_user helpers)
- `@tripwire/auth` (only for `assertRepoOwner` — see note below)

**Note on `assertRepoOwner`:** currently lives in `apps/web/src/integrations/trpc/init.ts`.
It's an auth helper that does a DB query. Move it into `@tripwire/auth` or
`@tripwire/core` so tools can call it without depending on tRPC.

**Migration:** `#/lib/tools` → `@tripwire/tools`.

**Risk:** medium. The tool definitions touch most of the other packages, so
this phase only works after 1–4 are done.

### Phase 6: `@tripwire/ui`

**Move:**
- `apps/web/src/lib/ai/ui-catalog.ts` → `packages/ui/src/catalog.ts`
- `apps/web/src/lib/ai/ui-registry.tsx` → `packages/ui/src/registry.tsx`
- `apps/web/src/components/ui/` (base primitives) → `packages/ui/src/components/`
- Design tokens / Tailwind theme → `packages/ui/src/styles/`
- `apps/web/src/styles.css` mostly stays in web; tokens move out.

**Skip:** route-specific components (`components/ask/`, `components/home/`,
`components/landing/`, `components/insights/`, `components/rules/`,
`components/layout/`) — those are app-specific.

**Tailwind setup:** with Tailwind v4 + Vite, packages export raw class names
and the consuming app's `tailwind.config` includes the package paths in
`content`.

**Risk:** medium. Lots of files; tailwind + json-render registry interplay
needs careful testing.

## Path-alias strategy

`apps/web` currently uses `#/*` → `./src/*`. Keep that. Packages use plain
`@tripwire/*` imports. Don't introduce `#/lib/...` paths inside packages.

## Per-phase verification

After each phase:
1. `pnpm install` — workspace links the new package.
2. `pnpm --filter @tripwire/web typecheck` — same 21 pre-existing errors,
   no new ones.
3. `pnpm --filter @tripwire/web dev` — boots, dev server serves the app.
4. Hit the chat + an MCP endpoint to confirm nothing broke at runtime.

## Out of scope for this plan

- Splitting tRPC routers into packages. Defer until the CLI needs them.
- Splitting `evlog` request-logger context — that's an `apps/web` concern
  for now. CLI will use direct console output instead.
- Moving `drizzle/` migrations to `@tripwire/db`. Keep migrations with the
  app that runs them until there's a reason to share.
- Build outputs: packages stay TS-source-only for now. Add `tsup` / build
  step only if a package becomes a published artifact.
