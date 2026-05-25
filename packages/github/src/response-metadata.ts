/**
 * Pure data + helpers shared between the read-through cache engine and
 * the GitHub fetch wrapper. Lives in its own module so consumers that
 * only need the response-shape types (e.g. `request.ts`) don't pull
 * in the DB-backed cache engine.
 */

export type GitHubConditionalHeaders = {
  etag?: string | null
  lastModified?: string | null
}

export type GitHubResponseMetadata = {
  etag: string | null
  lastModified: string | null
  rateLimitRemaining: number | null
  rateLimitReset: number | null
  statusCode: number
}

export type GitHubFetchResult<TData> =
  | { kind: "not-modified"; metadata: GitHubResponseMetadata }
  | { kind: "success"; data: TData; metadata: GitHubResponseMetadata }

export function parseNullableInt(
  value: string | null | undefined
): number | null {
  if (!value) return null
  const parsed = Number.parseInt(value, 10)
  return Number.isFinite(parsed) ? parsed : null
}

export function createGitHubResponseMetadata(
  statusCode: number,
  headers: Record<string, string | null | undefined>
): GitHubResponseMetadata {
  return {
    etag: headers.etag ?? null,
    lastModified: headers["last-modified"] ?? null,
    rateLimitRemaining: parseNullableInt(headers["x-ratelimit-remaining"]),
    rateLimitReset: parseNullableInt(headers["x-ratelimit-reset"]),
    statusCode,
  }
}
