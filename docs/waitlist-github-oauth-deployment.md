# Waitlist via GitHub OAuth — deployment notes

Cross-deployment "Join waitlist with GitHub" flow: the landing site opens a
popup to the app, the app runs GitHub OAuth through the existing auth stack, and
the new user lands in the existing approval queue as `accessStatus: "pending"`.
This flow reuses the access-queue system in `docs/github-approval-queue-prd.md`
— it adds **no new status, gate, or admin surface**. Only the popup plumbing is
new. These are the deployment-level knobs; nothing here is optional-by-default.

## Gate control — Databuddy feature flag (primary), env (fallback)

The closed-beta gate is controlled by the **Databuddy feature flag `access-gate`**,
not an env var. Toggle it from the Databuddy dashboard (project client id
`09661145-7249-45d9-a9e3-f1a93e9c7266`) — no redeploy to flip it.

- **Server (the real boundary):** `apps/web/src/lib/access-gate-flag.ts` evaluates
  the flag with `@databuddy/sdk/node` (`createServerFlagsManager`), used by the
  tRPC gate in `integrations/trpc/init.ts`.
- **Client (redirect UX):** `<FlagsProvider>` in `__root.tsx` + `useFlag('access-gate')`
  in `hooks/use-access-gate.ts`.
- **Fallback:** if Databuddy is unreachable, or the flag doesn't exist yet
  (`NOT_FOUND`/`ERROR`/`SESSION_PENDING`, or a thrown lookup), the server falls
  back to the `ACCESS_GATE_ENABLED` env var — a local kill-switch so the security
  boundary never hard-depends on an external service.

**To turn the gate on:** create/enable an `access-gate` flag in the Databuddy
dashboard. Until that flag exists it resolves `NOT_FOUND` → env fallback, so today
the gate is off. To test the block *before* wiring the dashboard flag, set
`ACCESS_GATE_ENABLED=true` (the fallback path) and restart the app.

## Environment variables

| Var | Deployment | Example | Purpose |
|-----|-----------|---------|---------|
| `VITE_WAITLIST_OPENER_ORIGINS` | **app** | `https://tripwire.sh,https://www.tripwire.sh` | Allowlist of landing origins the closer (`/oauth/popup-callback`) may `postMessage` to. The closer posts only to an exact origin from this list — never `*`. If unset/empty, the closer never messages an opener and falls back to in-place navigation. Add the local landing origin (e.g. `http://localhost:3001`) for dev. Build-time inlined (`VITE_`), not secret. |
| `NEXT_PUBLIC_APP_URL` | **landing** | `https://app.tripwire.sh` | App origin. Drives both the popup target (`${APP}/oauth/waitlist`) and the landing's strict `event.origin` check on incoming messages. Falls back to `https://app.tripwire.sh` (prod) / `http://localhost:3000` (dev) if unset. |

Both sides must agree: the app's `VITE_WAITLIST_OPENER_ORIGINS` must contain the
exact origin the landing serves from, and the landing's `NEXT_PUBLIC_APP_URL`
must be the exact app origin.

**`www` is canonical — include BOTH forms.** `tripwire.sh` 308-redirects to
`https://www.tripwire.sh`, so visitors end up on `www` and the popup's
`?opener=` is `https://www.tripwire.sh`. `VITE_WAITLIST_OPENER_ORIGINS` must list
**both** `https://tripwire.sh` and `https://www.tripwire.sh` (apex covers the
pre-redirect edge; www is what actually matches). Do NOT "tidy" this to the apex
alone — that reintroduces the dash-in-popup bug (origin mismatch → closer can't
notify → for an approved user it would fall to `/home` inside the popup).

The closer no longer depends on `window.opener` to know it's a popup — the
landing stamps `?mode=popup` and it's threaded through OAuth, so a mismatch (or a
future COOP header) degrades to a clean confirmation screen, never the dashboard.
A `waitlist_notify_failed` Databuddy event fires whenever a popup can't reach its
opener, so allowlist drift shows up as a dashboard blip, not a user report.

## COOP headers (Cross-Origin-Opener-Policy)

The popup relationship (`window.opener`) must not be severed.

- **Landing (opener):** currently sends **no** COOP header (`next.config.ts` has
  no `headers()`), which is what we want — `window.opener` survives. If COOP is
  ever added to the landing, it must be `same-origin-allow-popups`, or the
  opener handle is cut and every join silently falls back to full-page redirect.
- **App (popup):** sends no COOP either. `postMessage` works cross-origin
  regardless of COOP; COOP only governs the opener handle, which lives on the
  landing side. No change needed today — just don't add a bare
  `same-origin` COOP to the landing.

The code already degrades safely if an opener is severed (COOP, or popup blocked
→ full redirect): the closer navigates in place to `/queue`. So a COOP
regression downgrades UX (no auto-close) but never breaks the join.

## GitHub OAuth callback URL

**Unchanged.** OAuth still round-trips through `…/api/auth/callback/github` on
the app origin. The popup entry (`/oauth/waitlist`) and closer
(`/oauth/popup-callback`) are app-internal routes, not OAuth redirect URIs — no
new callback URL to register in the GitHub OAuth App.

## trustedOrigins

`packages/auth/src/index.ts` `trustedOrigins` is unchanged. The whole OAuth flow
runs on the app origin with an app-relative `callbackURL`, and the landing makes
no auth API calls, so the landing origins do **not** need to be added there.
(They are allowlisted for `postMessage` via `VITE_WAITLIST_OPENER_ORIGINS`,
which is a separate, narrower concern.)

## Dev ports

The app must own the origin in `BETTER_AUTH_URL` / the GitHub callback
registration — i.e. `http://localhost:3000`. The landing therefore must run on a
different port:

```bash
# app  (terminal 1) — owns :3000
cd ~/tripwire && pnpm dev
# landing (terminal 2)
cd ~/tripwire-landing && next dev -p 3001
```

Set `VITE_WAITLIST_OPENER_ORIGINS=http://localhost:3001` (app) and
`NEXT_PUBLIC_APP_URL=http://localhost:3000` (landing) for local end-to-end.

## Known tradeoff: promotion is instant, demotion is not

The gate trusts the cookie-cached session **only** when it already reads
`approved`; any other status triggers a fresh DB read (`resolveEffectiveStatus`
in `integrations/trpc/init.ts`). Consequences:

- **Promotion (pending → approved): effectively instant.** A pending user is
  re-read from the DB on every request, so an admin approval takes effect on
  their next request with no re-authentication. (This is the invariant-4
  guarantee, covered by `apps/web/src/lib/access-gate.test.ts`.)
- **Demotion (approved → rejected/banned): lags up to the 5-minute
  `cookieCache` TTL.** Because an `approved` session copy is trusted without a
  DB read, a just-demoted user keeps product access until their cookie cache
  expires (`session.cookieCache.maxAge = 5 * 60`). This is acceptable for a beta
  gate. If instant revocation is ever required, add explicit session
  invalidation on demote (Better Auth `revokeUserSessions`) rather than lowering
  the cache TTL globally.
```
