tripwire
---
Open source moderation for GitHub.

Tripwire watches your repos for low-signal activity (spammy issues, drive-by PRs, suspicious accounts, etc.) and lets you flag, filter, or block it with a configurable rules system. You install it as a GitHub App, point it at your repos, and enable rules.

## Setup

Clone:

```bash
git clone https://github.com/bountydotnew/tripwire.git
cd tripwire
bun install
```

Copy the example env file and fill it in:

```bash
cp .env.example .env
```

The required vars:

- `BETTER_AUTH_URL` — your local URL, usually `http://localhost:3000`
- `BETTER_AUTH_SECRET` — generate with `openssl rand -hex 32`
- `GITHUB_CLIENT_ID` / `GITHUB_CLIENT_SECRET` — from your GitHub OAuth App
- `GITHUB_APP_ID` / `GITHUB_APP_PRIVATE_KEY` / `GITHUB_WEBHOOK_SECRET` — from your GitHub App
- `VITE_GITHUB_APP_SLUG` — the slug from `github.com/apps/{slug}`
- `DATABASE_URL` — Postgres connection string

Optional:

- `UNKEY_ROOT_KEY` — rate limiting (allows all requests if unset)
- `AUTUMN_SECRET_KEY` — billing
- `AXIOM_TOKEN`, `AXIOM_DATASET`, `AXIOM_TRACES_DATASET` — logs and traces
- `OTEL_EXPORTER_OTLP_ENDPOINT` — OpenTelemetry endpoint, defaults to Axiom

Push tables to db:

```bash
bun run db:push
```

Start the dev server:

```bash
bun run dev
```

Open http://localhost:3000.

## Scripts

- `bun dev` — run the app
- `bun build` — build for production
- `bun test` — run tests
- `bun typecheck` — typecheck
- `bun db:studio` — open Drizzle Studio

## License

MIT.

<!--
## Sponsors
---
<a href="https://www.coderabbit.ai">
  <img src="https://github.com/user-attachments/assets/5bbfd2ad-78fa-4e2e-b9ae-fc0954a5da4b" alt="CodeRabbit" width="200" />
</a>
-->
