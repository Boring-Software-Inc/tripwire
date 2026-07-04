import {
  CircleDotIcon,
  GitPullRequestIcon,
  MessageSquareIcon,
} from "lucide-react"
import type { Metric } from "./chrome"

/** Mock content lifted from modkit's fixtures so the miniature reads real. */

export type QueueItem = {
  id: string
  icon: typeof MessageSquareIcon
  kind: string
  title: string
  repo: string
  number: number
  reportedAgo: string
  ageMinutes: number
  reason: "Spam" | "Harassment" | "Off-topic" | "Automod" | "NSFW"
  severity: "Critical" | "High" | "Medium" | "Low"
  severityWeight: number
  preview: string
  author: string
  authorHue: number
  reporter: string
  comments: number
  reactions: number
}

export const QUEUE_ITEMS: QueueItem[] = [
  {
    id: "q1",
    icon: MessageSquareIcon,
    kind: "Comment",
    title: "buy cheap followers + crypto airdrop 🚀🚀 link in bio",
    repo: "facebook/react",
    number: 31204,
    reportedAgo: "12m ago",
    ageMinutes: 12,
    reason: "Spam",
    severity: "Critical",
    severityWeight: 4,
    preview:
      "🚀🚀 GET 10K FOLLOWERS CHEAP + free $SLOP airdrop for the first 500 wallets — link in bio, dont miss out fam 🚀🚀",
    author: "a1rdr0p_k1ng",
    authorHue: 210,
    reporter: "automod",
    comments: 3,
    reactions: 1,
  },
  {
    id: "q2",
    icon: GitPullRequestIcon,
    kind: "Pull request",
    title: "Add 4000 lines of unrelated vendored code",
    repo: "biomejs/biome",
    number: 4711,
    reportedAgo: "38m ago",
    ageMinutes: 38,
    reason: "Spam",
    severity: "High",
    severityWeight: 3,
    preview:
      "This PR vendors an entire UI framework into /lib3 to fix a typo in the README. Adds 4,102 lines across 96 files.",
    author: "helpful-dev",
    authorHue: 20,
    reporter: "maintainer-em",
    comments: 12,
    reactions: 4,
  },
  {
    id: "q3",
    icon: MessageSquareIcon,
    kind: "Comment",
    title: "you people are clueless, this whole library is garbage",
    repo: "honojs/hono",
    number: 2988,
    reportedAgo: "1h ago",
    ageMinutes: 62,
    reason: "Harassment",
    severity: "High",
    severityWeight: 3,
    preview:
      "you people are clueless, this whole library is garbage and whoever merged this should never touch a keyboard again",
    author: "rage-quit-99",
    authorHue: 0,
    reporter: "community-mod",
    comments: 7,
    reactions: 2,
  },
  {
    id: "q4",
    icon: MessageSquareIcon,
    kind: "Comment",
    title: "Automod: matched blocklist pattern in comment",
    repo: "cloudflare/workers-sdk",
    number: 6120,
    reportedAgo: "1h ago",
    ageMinutes: 71,
    reason: "Automod",
    severity: "Medium",
    severityWeight: 2,
    preview:
      "check out my new site totally-not-a-scam[.]xyz for free credits — pattern `(free credits|airdrop)` matched twice.",
    author: "new-user-3021",
    authorHue: 280,
    reporter: "automod",
    comments: 0,
    reactions: 0,
  },
  {
    id: "q5",
    icon: MessageSquareIcon,
    kind: "Comment",
    title: "checkout my onlyfans 🔥 not safe for work content here",
    repo: "facebook/react",
    number: 31190,
    reportedAgo: "2h ago",
    ageMinutes: 118,
    reason: "NSFW",
    severity: "High",
    severityWeight: 3,
    preview:
      "hey everyone checkout my page 🔥🔥 18+ content, link below (removed) — posted to 14 threads in 6 minutes.",
    author: "spicy_content4u",
    authorHue: 320,
    reporter: "automod",
    comments: 1,
    reactions: 0,
  },
  {
    id: "q6",
    icon: CircleDotIcon,
    kind: "Issue",
    title: "+1 +1 +1 please merge this is urgent for my job interview",
    repo: "drizzle-team/drizzle-orm",
    number: 3350,
    reportedAgo: "3h ago",
    ageMinutes: 185,
    reason: "Off-topic",
    severity: "Low",
    severityWeight: 1,
    preview:
      "+1 +1 +1 pls merge i have a job interview tomorrow and need this feature, also can someone review my resume",
    author: "urgent-merger",
    authorHue: 140,
    reporter: "maintainer-em",
    comments: 21,
    reactions: 9,
  },
]

export type RuleMatch = {
  id: string
  where: string
  ago: string
  snippet: string
}

export type Rule = {
  id: string
  name: string
  category: "Blocklist" | "Heuristic" | "Classifier" | "Regex"
  description: string
  pattern: string
  action: string
  scope: string
  hits: number
  fpRate: number
  lastFired: string
  enabled: boolean
  series: number[]
  matches: RuleMatch[]
}

export const RULES: Rule[] = [
  {
    id: "r1",
    name: "Known spam domains",
    category: "Blocklist",
    description:
      "Blocks links to a maintained blocklist of spam and scam domains, updated hourly from three shared feeds.",
    pattern: "url.domain in @blocklists/spam-domains",
    action: "Hide + report",
    scope: "Comments · Issues · PRs",
    hits: 41,
    fpRate: 2,
    lastFired: "9m ago",
    enabled: true,
    series: [3, 5, 4, 7, 6, 9, 8, 11],
    matches: [
      {
        id: "m1",
        where: "facebook/react #31204",
        ago: "12m ago",
        snippet:
          "🚀 free $SLOP airdrop for the first 500 wallets — link in bio",
      },
      {
        id: "m2",
        where: "honojs/hono #3001",
        ago: "44m ago",
        snippet:
          "grab discounted followers at follow-farm[.]shop before it's gone",
      },
    ],
  },
  {
    id: "r2",
    name: "New-account burst",
    category: "Heuristic",
    description:
      "Flags accounts younger than 7 days posting more than 5 times in 10 minutes across the org.",
    pattern: "account.age < 7d AND posts(10m) > 5",
    action: "Flag for review",
    scope: "All activity",
    hits: 23,
    fpRate: 9,
    lastFired: "31m ago",
    enabled: true,
    series: [2, 4, 3, 6, 5, 7, 6, 8],
    matches: [
      {
        id: "m3",
        where: "cloudflare/workers-sdk #6120",
        ago: "1h ago",
        snippet: "posted to 14 threads in 6 minutes from a 2-day-old account",
      },
    ],
  },
  {
    id: "r3",
    name: "Crypto & airdrop promos",
    category: "Regex",
    description:
      "Catches token-drop, wallet-drainer, and follower-farm promotions in any commentable surface.",
    pattern: "/(airdrop|free (credits|tokens)|10k followers)/i",
    action: "Hide + report",
    scope: "Comments",
    hits: 17,
    fpRate: 4,
    lastFired: "2h ago",
    enabled: true,
    series: [5, 4, 6, 3, 5, 4, 6, 5],
    matches: [
      {
        id: "m4",
        where: "biomejs/biome #4699",
        ago: "2h ago",
        snippet: "free credits airdrop happening now, connect wallet to claim",
      },
    ],
  },
  {
    id: "r4",
    name: "Harassment & threats",
    category: "Classifier",
    description:
      "Language-model classifier for hostile, demeaning, or threatening language aimed at people.",
    pattern: "classifier(harassment) > 0.86",
    action: "Flag for review",
    scope: "Comments · Issues",
    hits: 4,
    fpRate: 16,
    lastFired: "5h ago",
    enabled: false,
    series: [1, 2, 1, 3, 2, 2, 1, 2],
    matches: [
      {
        id: "m5",
        where: "honojs/hono #2988",
        ago: "1h ago",
        snippet: "whoever merged this should never touch a keyboard again",
      },
    ],
  },
  {
    id: "r5",
    name: "Profanity classifier",
    category: "Classifier",
    description:
      "Softer profanity filter that hides rather than reports; tuned for false-positive caution.",
    pattern: "classifier(profanity) > 0.92",
    action: "Hide only",
    scope: "Comments",
    hits: 11,
    fpRate: 6,
    lastFired: "26m ago",
    enabled: true,
    series: [2, 3, 4, 3, 5, 4, 5, 6],
    matches: [
      {
        id: "m6",
        where: "drizzle-team/drizzle-orm #3344",
        ago: "26m ago",
        snippet: "(hidden) — matched at 0.95 confidence, author notified",
      },
    ],
  },
]

/* ------------------------------------------------------------ analytics */

export const METRICS: Record<"moderation" | "automod", Metric[]> = {
  moderation: [
    {
      key: "pending",
      label: "Pending reports",
      value: "14",
      delta: 3,
      invertDelta: true,
      color: "red",
      series: [6, 9, 7, 12, 10, 15, 13, 18, 14, 19, 16, 22],
    },
    {
      key: "resolved",
      label: "Resolved today",
      value: "38",
      delta: 12,
      color: "blue",
      series: [8, 10, 9, 12, 14, 13, 16, 15, 18, 21, 19, 24],
    },
    {
      key: "automod",
      label: "Automod hits · 24h",
      value: "112",
      delta: -9,
      invertDelta: true,
      color: "purple",
      series: [12, 9, 11, 8, 10, 7, 9, 6, 8, 5, 7, 4],
    },
    {
      key: "banned",
      label: "Banned users",
      value: "6",
      delta: 2,
      color: "orange",
      series: [2, 3, 2, 4, 3, 5, 4, 4, 6, 5, 6, 7],
    },
  ],
  automod: [
    {
      key: "rules",
      label: "Active rules",
      value: "5",
      delta: 1,
      color: "blue",
      series: [3, 3, 4, 4, 4, 5, 5, 5, 4, 5, 5, 5],
    },
    {
      key: "matches",
      label: "Matches · 24h",
      value: "96",
      delta: -14,
      invertDelta: true,
      color: "purple",
      series: [14, 12, 13, 10, 11, 9, 10, 8, 9, 7, 8, 6],
    },
    {
      key: "fp",
      label: "False-positive rate",
      value: "7",
      suffix: "%",
      delta: -2,
      invertDelta: true,
      color: "pink",
      series: [11, 10, 9, 10, 8, 9, 8, 7, 8, 7, 7, 6],
    },
    {
      key: "actioned",
      label: "Auto-actioned · 24h",
      value: "61",
      delta: 8,
      color: "orange",
      series: [4, 6, 5, 8, 7, 9, 8, 11, 10, 12, 11, 14],
    },
  ],
}

export type AnalyticsEvent = {
  id: string
  title: string
  detail: string
  ago: string
  at: number // series index the event belongs to
  impact?: { label: string; good: boolean }
}

export const ANALYTICS_EVENTS: AnalyticsEvent[] = [
  {
    id: "e1",
    title: "Blocklist feed sync added 214 domains",
    detail: "automod · Known spam domains",
    ago: "2h ago",
    at: 10,
    impact: { label: "▼ 12", good: true },
  },
  {
    id: "e2",
    title: "Spam wave hit facebook/react",
    detail: "31 reports in 40 minutes",
    ago: "5h ago",
    at: 7,
    impact: { label: "▲ 31", good: false },
  },
  {
    id: "e3",
    title: "grim banned a1rdr0p_k1ng",
    detail: "repeat offender · 3 strikes",
    ago: "8h ago",
    at: 5,
  },
  {
    id: "e4",
    title: "New-account burst rule enabled",
    detail: "automod · heuristic",
    ago: "12h ago",
    at: 3,
    impact: { label: "▼ 8", good: true },
  },
  {
    id: "e5",
    title: "Nightly sweep resolved 22 stale reports",
    detail: "queue hygiene",
    ago: "1d ago",
    at: 1,
  },
]

/* ---------------------------------------------------------- integrations */

export type Repo = { name: string; owner: string; isPrivate: boolean }

const VERCEL_REPOS = [
  "next.js",
  "turbo",
  "ai",
  "swr",
  "satori",
  "commerce",
  "examples",
  "analytics",
  "edge-runtime",
  "platforms",
]
const RIPGRIM_REPOS = ["modkit", "tripwire", "honeypot", "dotfiles", "lander"]

export const REPOS: Repo[] = [
  ...VERCEL_REPOS.map((name) => ({
    name,
    owner: "vercel",
    isPrivate: false,
  })),
  ...RIPGRIM_REPOS.map((name) => ({
    name,
    owner: "ripgrim",
    isPrivate: name !== "modkit",
  })),
]

export const ACCOUNTS = [
  {
    login: "vercel",
    type: "Organization",
    avatar: "https://github.com/vercel.png",
  },
  {
    login: "ripgrim",
    type: "Personal account",
    avatar: "https://github.com/ripgrim.png",
  },
]
