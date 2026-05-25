import { createError } from "evlog"

const PER_PAGE = 100
const MAX_PAGES = 500

export interface GitHubUserMin {
  login: string
  id: number
}

export interface GitHubPullRequestMin {
  number: number
  title: string
  state: "open" | "closed"
  user: GitHubUserMin | null
  created_at: string
  merged_at: string | null
  closed_at: string | null
}

export interface GitHubIssueMin {
  number: number
  title: string
  state: "open" | "closed"
  user: GitHubUserMin | null
  created_at: string
  closed_at: string | null
  pull_request?: unknown
}

const REQUEST_TIMEOUT_MS = 15_000

async function fetchPage<T>(
  path: string,
  token: string,
  page: number
): Promise<T[]> {
  const sep = path.includes("?") ? "&" : "?"
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)
  let res: Response
  try {
    res = await fetch(
      `https://api.github.com${path}${sep}per_page=${PER_PAGE}&page=${page}`,
      {
        signal: controller.signal,
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "application/vnd.github+json",
          "X-GitHub-Api-Version": "2022-11-28",
        },
      }
    )
  } finally {
    clearTimeout(timeout)
  }
  if (!res.ok) {
    const text = await res.text()
    throw createError({
      code: `github.api.${res.status}`,
      status: res.status >= 500 ? 502 : res.status,
      message: `GitHub API ${res.status}: ${text}`,
      internal: { path, page, githubStatus: res.status, githubBody: text },
    })
  }
  return res.json() as Promise<T[]>
}

async function paginate<T>(
  path: string,
  token: string,
  onPage?: (items: T[], page: number) => void | Promise<void>
): Promise<T[]> {
  const all: T[] = []
  for (let page = 1; page <= MAX_PAGES; page++) {
    const items = await fetchPage<T>(path, token, page)
    if (items.length === 0) break
    if (onPage) await onPage(items, page)
    all.push(...items)
    if (items.length < PER_PAGE) break
  }
  return all
}

export function listAllPullRequests(
  token: string,
  owner: string,
  repo: string,
  opts?: {
    onPage?: (
      items: GitHubPullRequestMin[],
      page: number
    ) => void | Promise<void>
  }
): Promise<GitHubPullRequestMin[]> {
  return paginate<GitHubPullRequestMin>(
    `/repos/${owner}/${repo}/pulls?state=all&sort=created&direction=asc`,
    token,
    opts?.onPage
  )
}

export async function listAllIssues(
  token: string,
  owner: string,
  repo: string,
  opts?: {
    onPage?: (items: GitHubIssueMin[], page: number) => void | Promise<void>
  }
): Promise<GitHubIssueMin[]> {
  const items = await paginate<GitHubIssueMin>(
    `/repos/${owner}/${repo}/issues?state=all&sort=created&direction=asc`,
    token,
    opts?.onPage
  )
  return items.filter((i) => !i.pull_request)
}
