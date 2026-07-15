# PRD: GitHub Sign-In Approval Queue

**Status:** Draft
**Owner:** Dan
**Date:** 2026-07-14

## Summary

Replace the email-only landing-page waitlist with an approval queue gated behind GitHub sign-in. Prospective users authenticate with GitHub, land in a `pending` state, and get access only when an admin manually approves them. Approved users are notified by email.

## Problem

The current waitlist spans two repos: the form and its client API calls live on the marketing site (`tripwire-landing`), which hits the `waitlistRouter.join` endpoint in this repo (`tripwire`, writing to the `waitlist` table). It collects only an email address. That gives us:

- No identity signal — we can't see who's asking for access, which matters for a product whose whole pitch is GitHub reputation and spam filtering.
- No activation path — when we open access, an email on a list still has to come back, sign in with GitHub, and onboard. Two drop-off points.
- No admin tooling — approvals happen ad hoc, outside the product.

## Goals

1. Every access request is a real GitHub identity we can review (username, avatar, account age, orgs via existing `read:user` / `read:org` scopes).
2. Admins can review, approve, and reject requests from the existing `_admin` area.
3. Approval → automated email → user signs in and lands directly in onboarding. One click from "you're in" to activated.
4. Existing email waitlist entries are migrated, not stranded.

## Non-Goals

- Auto-approval rules (vouches, GitHub signal thresholds). All approvals are manual for v1; the design shouldn't preclude adding rules later.
- Invite codes, referral mechanics, or user-to-user invites.
- Keeping the email-only form. It's removed once migration email is sent.

## User Flows

### New user
1. Visits the marketing site (`tripwire-landing`) → CTA is "Sign in with GitHub to request access" (replaces the email form). This is a plain link to the app's `/login` — no client API call from the landing site; OAuth happens on the app domain.
2. Completes GitHub OAuth (existing better-auth flow, `packages/auth/src/index.ts`).
3. Account is created with `accessStatus = "pending"`. User sees a "You're in the queue" page showing their GitHub identity and queue position or a simple "we'll email you" message.
4. Any attempt to reach `_app` routes while pending redirects back to the queue page.

### Admin
1. Opens **Admin → Access Requests** (`_admin` section).
2. Sees a table of pending users: avatar, GitHub username (linked), email, account created date, GitHub account age, request date.
3. Approves or rejects individually; bulk approve for selected rows.
4. Approve → status flips to `approved`, Inngest job sends the approval email. Reject → status `rejected`; user sees a polite "not yet" on next visit (no email in v1).

### Approved user
1. Receives email: "You're in" + sign-in link.
2. Signs in → passes the gate → routed to existing `/onboarding`.

### Existing email waitlist
1. One-time campaign email to all `waitlist` rows: "Sign in with GitHub to claim your spot."
2. Optional: emails already on the waitlist get flagged so admins see "was on email waitlist since {date}" in the queue — useful for prioritising loyal early signups.
3. `waitlist` table and `waitlistRouter` are retired after the campaign window (suggest 30 days).

## Functional Requirements

| # | Requirement |
|---|-------------|
| F1 | Add `accessStatus` (`pending` \| `approved` \| `rejected`) and `accessReviewedAt` / `accessReviewedBy` to the user model (better-auth `additionalFields` or a sibling table in `packages/db/src/schema/auth.ts`). |
| F2 | New signups via GitHub OAuth default to `pending`. Existing active users are backfilled to `approved` in the migration. |
| F3 | Route guard: `pending`/`rejected` users cannot access `_app` or `_admin` routes; redirect to queue-status page. Enforce server-side (tRPC middleware), not just in the router. |
| F4 | Admin tRPC router: `accessRequests.list` (paginated, filter by status, search by username/email), `accessRequests.approve`, `accessRequests.reject`, `accessRequests.bulkApprove`. All behind `adminProcedure`. |
| F5 | Approval email sent via Inngest job on approve event — retryable, idempotent (don't double-send on bulk approve retries). |
| F6 | Queue-status page for pending users; distinct copy for rejected users. |
| F7 | Cross-repo swap: in `tripwire-landing`, the waitlist form and its client API calls are replaced with a GitHub sign-in CTA linking to the app's `/login`; in `tripwire`, the `waitlistRouter.join` endpoint is retired (after the migration window) along with the in-repo `waitlist-form.tsx`. |
| F8 | Rate limiting on the OAuth-initiated request path reuses `@tripwire/ratelimit` patterns where applicable. |

## Technical Notes

- **Where the status lives:** prefer better-auth `additionalFields` on `user` so the status rides along in the session — the route guard then needs no extra query. Fall back to a join table only if better-auth field constraints bite.
- **Gate placement:** tRPC middleware in `integrations/trpc/init.ts` (new `approvedProcedure` or extend `protectedProcedure`) plus a `beforeLoad` check in `_app.tsx`. Server-side check is the source of truth.
- **Email:** use [Email SDK](https://email-sdk.dev) (`@opencoredev/email-sdk`) — a zero-dependency TypeScript layer with one typed `send()` over 23 providers, so the provider choice stays a config change. Suggested setup: new `packages/email` exporting a shared client (Resend primary, retries enabled), env vars in `packages/env`. See Appendix A for the docs excerpt. This is the only net-new infra.
- **Admin UI:** follow existing `_admin` patterns and `@tanstack/react-table` usage; formatting via `apps/web/src/lib/format.ts` per repo rules.
- **GitHub metadata:** username/avatar come from the better-auth `account` record; account age can be fetched lazily per row via the existing GitHub client in `packages/github` — don't block queue rendering on it.
- **Cross-repo split:** `tripwire-landing` owns only the CTA swap (form + client API calls removed, replaced by a link to the app's `/login`). Everything else — OAuth, pending gate, queue-status page, admin queue, emails, endpoint retirement — lives in `tripwire`. Because the CTA is a plain link, no CORS or shared API surface is needed between the two. If the landing site later wants live queue stats, that becomes a new public endpoint decision, out of scope for v1.

## Metrics

- Sign-in → pending conversion on the landing CTA (vs. historical email form conversion).
- Approval → first onboarding step completion rate (target: >60% within 7 days of approval email).
- Median time-to-approval (admin SLA; target <48h so the queue doesn't go cold).
- Email waitlist migration claim rate during the 30-day window.

## Risks

- **CTA friction:** OAuth is a bigger ask than an email field; top-of-funnel volume may drop. Mitigation: the identities we do get are far higher intent, and copy should sell what approval unlocks.
- **Queue neglect:** manual-only approval means the queue is only as good as admin responsiveness. Mitigation: time-to-approval metric + optional daily digest (Inngest cron) of pending count.
- **Session staleness:** a user approved mid-session needs the status reflected without re-login — verify better-auth session refresh behaviour or force re-fetch on the queue-status page.

## Open Questions

1. Do rejected users get a re-request path, or is rejection terminal for v1?
2. Should the queue-status page show position/estimated wait, or keep it vague to preserve approval flexibility?
3. ~~Which mail provider?~~ **Resolved:** Email SDK (`@opencoredev/email-sdk`) with Resend as the primary adapter. Remaining sub-question: add a fallback adapter (e.g. Postmark) now or once volume justifies a second provider account?

## Rollout

1. Schema migration + backfill existing users to `approved`.
2. Ship gate + queue-status page behind a feature flag (`lib/feature-flags.ts`).
3. Ship admin queue UI; dogfood with flag on for new signups only.
4. Swap the CTA in `tripwire-landing` (form + client API calls → link to app `/login`); send migration email to the `waitlist` table. Keep `waitlistRouter.join` live during the window so the old form keeps working until the landing deploy ships — landing deploys first, endpoint retires later, never the reverse.
5. Retire `waitlistRouter` in `tripwire` (and the in-repo `waitlist-form.tsx`) after the 30-day claim window.

---

## Appendix A: Email SDK reference (email-sdk.dev)

Condensed from [email-sdk.dev/docs](https://email-sdk.dev/docs) (v0.6.5) for implementation context.

### What it is

Zero-dependency TypeScript library for transactional email. One typed message shape; configured adapters decide how it reaches Resend, Postmark, SendGrid, AWS SES, Mailgun, SMTP, or any of 23 providers. Switching providers or adding an outage fallback is a config change — application code (`email.send(...)`) never changes. Each adapter is a separate entry point, so the bundle only contains providers actually used. It is **not** a campaign tool, queue, or template engine — Inngest stays our queue/retry-at-job-level layer; Email SDK handles the send itself.

### Setup (our shape)

```bash
pnpm add @opencoredev/email-sdk   # Node 20+; server-side only
```

```ts
// packages/email/src/index.ts
import { createEmailClient } from "@opencoredev/email-sdk"
import { resend } from "@opencoredev/email-sdk/resend"

export const email = createEmailClient({
  adapters: [resend({ apiKey: env.RESEND_API_KEY })],
  retry: { retries: 2 },
})
```

```ts
const result = await email.send({
  from: "Tripwire <hello@tripwire.sh>",
  to: user.email,
  subject: "You're in",
  text: "Your Tripwire access is approved. Sign in to get started.",
})
// result.provider — adapter that delivered; result.id — provider message id
```

### Retries and fallbacks

Default is one attempt. `retry: { retries: 2 }` retries only transient errors (HTTP 408/409/425/429/5xx, network) with exponential backoff (`min(100 * 2^(attempt-1), 2000)`ms); validation errors and hard rejections fail immediately. A fallback adapter (`fallback: ["postmark"]`) handles full outages after the primary exhausts retries. A fallback must support every field the message uses — the SDK throws `EmailValidationError` before the request rather than silently dropping fields (e.g. SMTP can't carry tags/metadata/attachments; Resend has no metadata field). Check the [field support matrix](https://email-sdk.dev/docs/adapters/field-support) when adding a backup route.

### Idempotency (relevant to F5)

Retries + fallbacks mean one logical send can become several provider requests. Every user-visible send gets a stable key:

```ts
await email.send(message, { idempotencyKey: `access-approved:${user.id}` })
```

Resend enforces this natively via its `Idempotency-Key` header. Combined with Inngest's own idempotency, this covers the F5 "no double-send on bulk-approve retries" requirement at both layers.

### Plugins worth wiring

- `defaultsPlugin` — org-wide `replyTo`, headers, and `sendMetadata` merged into every message; per-message values win. Supports `idempotencyKeyPrefix` to namespace keys per environment.
- `observabilityPlugin` — emits `email.sent` / `email.retry` / `email.error` with redacted payloads (counts, tags, subject — never bodies or recipients). Observer exceptions are swallowed, so monitoring can't break a send.

### Testing (no provider account needed)

`memoryProvider` / `failingProvider` from `@opencoredev/email-sdk/testing` plus `capturePlugin` let unit tests assert routing and payloads:

```ts
const backup = memoryProvider("backup")
const client = createEmailClient({
  adapters: [failingProvider("primary"), backup],
  fallback: ["backup"],
  retry: { retries: 2, delay: () => 0 },
  plugins: [capturePlugin()],
})
// assert response.provider === "backup", backup.raw.sent, captured events
```

### CLI verification

```bash
npx email-sdk doctor --adapter resend          # env/credentials check
npx email-sdk send --adapter resend --dry-run \
  --from "Tripwire <hello@tripwire.sh>" --to test@example.com \
  --subject "Check" --text "It works"          # validates shape + field support, no request
```

Dry-run validates locally; deliverability (verified sender domain, API scopes, sandbox rules) still needs one real smoke send from the production environment before launch.

**Further reading:** [Quickstart](https://email-sdk.dev/docs/getting-started/quickstart) · [Production send pipeline](https://email-sdk.dev/docs/guides/production-send-pipeline) · [Adapters](https://email-sdk.dev/docs/adapters) · [Fallbacks & retries](https://email-sdk.dev/docs/concepts/fallbacks-and-retries) · [Agent skill](https://email-sdk.dev/docs/agents/skill)
