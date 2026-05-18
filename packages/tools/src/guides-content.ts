export const SERVER_INSTRUCTIONS = `
Tripwire is an open-source GitHub moderation tool. Maintainers install the
Tripwire GitHub App on a repo, configure rules, and Tripwire automatically
closes / warns / logs PRs, issues, and comments from low-signal accounts.

The Tripwire MCP server gives you read-only tools to inspect a maintainer's
repos and investigate flagged users. Moderation mutations are handled through
the Tripwire chat UI, where the server can require signed user approval.

## First contact

On the very first turn of a session, call list_repos once so casual
references like "the repo" or "my repo" later can be resolved without
guessing. Do NOT pre-fetch events or rule configs — only call those
when the user actually asks for that information.

## Repo IDs

Every repo-scoped tool takes a repoId (uuid) at the MCP boundary. The
repo's GitHub full_name (e.g. "vercel/next.js") is in the list_repos
result alongside the id. Resolve casual names from your cached
list_repos result. Do NOT guess a repoId.

## Tool surface

Read-only:
- list_repos
- get_repo_rules                       — full rule config including scopeOverride
- list_lists                           — whitelist + blacklist
- check_lists({ username })            — is this user on either list?
- list_events({ ... })                 — newest first; filter by username/action/severity
- get_event({ eventId })
- lookup_user({ username })            — reputation + recent events for a GitHub user
- get_guide({ topic })                 — conceptual docs

Rule ids are constrained by the tool schema (zod enum), so the model
sees the valid set up front and never has to guess. Same for actions
(block | warn | log | threshold) and scope keys.

## Rule actions

- "block"     — close the PR / delete the comment immediately.
- "warn"      — post a friendly warning comment, leave the content open.
- "log"       — emit an event only; no GitHub-visible action.
- "threshold" — count violations per (user, rule); only block once the
                count reaches thresholdCount (default 3). Lower
                thresholds count as warn until the cap is hit.

When configuring rules for a new repo, prefer "warn" or "threshold" over
"block" unless the maintainer is specific. Block is destructive and
closing a legitimate PR is a worse failure mode than warning a spammer.

## Safety

- MCP cannot mutate moderation state. If the user asks to change lists
  or rules, explain that those changes must happen through Tripwire chat
  where signed approval is enforced.
- Identity: prefer GitHub user IDs (immutable) over usernames where the
  tool exposes both. Usernames can be renamed and re-registered.

## When in doubt

Call get_guide({ topic: "..." }) for deeper conceptual docs. Topics:
- "tripwire-mcp-instructions" — this guide.
- "rules" — what each rule checks + recommended thresholds.
- "lists" — whitelist/blacklist semantics, identity, conflict rules.
- "events" — event taxonomy, severities, reputation scoring.
`.trim();

export const GUIDES: Record<string, string> = {
	"tripwire-mcp-instructions": SERVER_INSTRUCTIONS,
	rules: `
# Tripwire rules

Each rule has \`enabled\` (bool), \`action\` (block | warn | log | threshold),
an optional \`scopeOverride\`, and rule-specific fields. The full schema
lives at \`src/lib/rules/config-schema.ts\` in the Tripwire repo.

Built-in rules:

- **aiSlopDetection** — heuristics for AI-generated PR/issue bodies.
  No threshold field.
- **languageRequirement** — block content that isn't the configured language.
- **minMergedPrs** — require the author to have at least N merged PRs
  across GitHub.
- **accountAge** — require account age >= N days.
- **maxPrsPerDay** — cap PRs per author per repo per day.
- **maxFilesChanged** — cap files-changed per PR.
- **repoActivityMinimum** — require author to have N public non-fork repos.
- **requireProfileReadme** — require the author's profile to have a README.
  No threshold field.
- **cryptoAddressDetection** — block content containing crypto addresses.
  No threshold field.
- **vouchedUsersOnly** — only allow whitelisted users + repo collaborators.
  No threshold field.
- **aiHoneypot** — embed honeypot phrases in PR templates; flag any PR
  body containing them (because only an LLM would copy them in).
  No threshold field.

Recommended thresholds:
- minMergedPrs.count: 3 for active repos, 1 for new ones.
- accountAge.days: 30 is a common minimum.
- maxPrsPerDay.limit: 5 catches spammers without blocking real contributors.

## Scope

Every rule applies to the content types in the repo-wide contentScope
({ pullRequests, issues, comments }) unless the rule has a scopeOverride.
The override only sets the keys you pass — unset keys still inherit.

Common pattern: keep contentScope tight (e.g. PRs only) and use
Tripwire chat's signed approval flow to widen a specific rule
(e.g. cryptoAddressDetection) to issues + comments where spam is more common.

## GitHub API failure mode

For action=block or action=threshold, if GitHub's API is unreachable
when evaluating a rule, the pipeline treats it as "unable to verify"
and emits pipeline_warned (does NOT allow the content through). For
warn/log, lookup failures fail open.
`.trim(),
	lists: `
# Whitelist & blacklist

Both tables are scoped per-repo. A user can be on the whitelist OR the
blacklist for a given repo, never both.

## Conflicts

- Blocking a user atomically removes any existing whitelist entry for
  the same user.
- Whitelisting rejects while the user is currently blacklisted; remove the
  blacklist entry through Tripwire chat first if the intent is to whitelist.

## Identity

- The pipeline matches blacklist/whitelist entries by GitHub user ID
  first (immutable), falling back to lowercased username for legacy
  rows that don't have a user ID.
- This means a user renaming themselves doesn't escape a blacklist.
- Username comparisons are case-insensitive everywhere.

## Effect on the moderation pipeline

- Whitelist: ALL rules are skipped for whitelisted users. Their content
  passes through untouched. Use sparingly — this is a "trusted contributor"
  bypass, not a "frequent contributor" reward.
- Blacklist: ALL content from blacklisted users is closed immediately,
  with no rule evaluation. Treat as the equivalent of a repo-level ban.

## Recommended workflow

- For a one-off spammer: use Tripwire chat to add them to the blacklist.
- For a known good contributor who keeps tripping a strict rule:
  whitelist them through Tripwire chat (preferred) OR loosen the rule
  (broader effect).
- For someone who looks suspicious but isn't clearly spam: leave both
  alone and let warn / threshold rules do their thing.
`.trim(),
	events: `
# Events

Every moderator-visible action in Tripwire emits an event. The events
feed is the audit log + the input to user reputation scoring.

## Event actions

- pipeline_blocked   — pipeline closed/deleted content.
- pipeline_warned    — pipeline left content open but posted a warning.
- pipeline_logged    — pipeline only logged, no GitHub action.
- pr_closed          — manual or automatic PR close (rule-triggered).
- issue_closed       — same for issues.
- issue_deleted      — issue was deleted (issue_comment events).
- comment_deleted    — comment was deleted.
- blacklist_blocked  — content blocked because user is blacklisted
                       (no rule evaluation happened).
- rule_near_miss     — user passed a rule but was within 20% of failing.
- whitelist_bypass   — content allowed because user is whitelisted.
- whitelist_added / whitelist_removed
- blacklist_added / blacklist_removed
- rule_config_updated
- request_submitted / request_decided — contributor unblock / access
                       requests submitted through the public appeal page.
- user_blocked       — full org-level block.
- bot_blacklisted    — bot account auto-blacklisted.
- rule_triggered     — generic rule fire (some rules emit this in
                       addition to the pipeline_* outcome).

## Severities

- error    — high-severity block.
- warning  — medium-severity flag.
- success  — positive event (allowed, request approved).
- info     — neutral.

## Reputation scoring

The github_reputation table is scoped per-(repo, user). Score formula:

  score = totalAllows - (totalBlocks * 3) - totalNearMisses

Only pipeline_blocked and blacklist_blocked increment totalBlocks.
pipeline_warned and pipeline_logged are NOT counted as blocks — they're
informational.
`.trim(),
};
