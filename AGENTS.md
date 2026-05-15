## Learned User Preferences
- Prefer copy edits that preserve the user's original wording and tone rather than rewrites.
- Prefer casual, human-sounding writing; avoid polished AI patterns.
- Avoid em dashes and formulaic contrast phrasing like "it's not X, it's Y."
- When showing tightly related counters in UI (for example merged vs closed PR totals), prefer one plain sentence that partitions the numbers once instead of repeating the same figure in multiple ratio fragments.
- For SVG markup that uses fill="currentColor", set visible color via Tailwind text-* (CSS color); fill-* on the svg is not the same lever as forcing inherited text color for that pattern.
- Tailwind only emits utilities it can see as literal class substrings at build time; do not rely on template strings that build arbitrary pixel width classes from variables. Use explicit class names or inline width styles when the size comes from props or variables.

## Learned Workspace Facts
- Tripwire is an open source GitHub moderation tool.
- Tripwire includes a configurable rules system for flagging, filtering, or blocking low-signal activity.
- Contributor trust scoring mixes Tripwire-local moderation outcomes with GitHub Search aggregates such as merged and closed PR counts, public fork vs non-fork repository totals, and optional PR totals against the Tripwire-connected repository.


## Median Tasks

Before starting work, check your assigned tasks:

```
mdn tasks --agent <your-agent-name>
```

When picking up a task:

```
mdn status <TASK-CODE> in_progress --agent <your-agent-name>
```

When completing a task:

```
mdn status <TASK-CODE> ready --agent <your-agent-name>
```

To create a new task:

```
mdn create --title "Description" --status todo --priority medium --agent <your-agent-name>
```

## Commit Messages & Pull Requests

Always include the Median task ID in commit messages and PR titles so tasks get marked automatically.

```
git commit -m "MDN-42 fix: resolve auth token expiry"
```

For pull requests, include the task ID in the title:

```
MDN-42 fix: resolve auth token expiry
```
