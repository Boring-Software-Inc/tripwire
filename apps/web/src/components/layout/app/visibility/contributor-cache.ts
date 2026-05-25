import type { QueryKey } from "@tanstack/react-query"

/**
 * Feature-local cache helpers for the visibility surface. The
 * `bulkAction` mutation needs to flip contributor rows across every
 * cached `listContributors` variant (different sort / filter / page)
 * without dropping back to a re-fetch.
 *
 * These all compose with the generic `patchOptimistic` primitive in
 * `lib/use-optimistic-mutation.ts` — that primitive knows nothing
 * about contributors; this module knows nothing about react-query.
 */

export type ContributorAction =
  | "whitelist"
  | "blacklist"
  | "removeWhitelist"
  | "removeBlacklist"

/**
 * Translate a `bulkAction` verb into the steady-state contributor
 * status it produces. Shared so visibility-page + drawer flip rows the
 * same way during optimistic updates.
 */
export function nextContributorStatus(
  action: ContributorAction
): "whitelisted" | "blacklisted" | "normal" {
  if (action === "whitelist") return "whitelisted"
  if (action === "blacklist") return "blacklisted"
  return "normal"
}

/**
 * Updater that flips status on every row whose username is in the
 * target set. Composes with `patchOptimistic({ predicate: ... })`.
 */
export function flipContributorStatuses<
  TList extends {
    items: Array<{ githubUsername: string; status: string }>
  },
>(targetUsernames: readonly string[], nextStatus: string) {
  const targetSet = new Set(targetUsernames.map((u) => u.toLowerCase()))
  return (current: TList): TList => ({
    ...current,
    items: current.items.map((row) =>
      targetSet.has(row.githubUsername.toLowerCase())
        ? { ...row, status: nextStatus }
        : row
    ),
  })
}

/**
 * Remove every row whose username matches. Used by the recommendation
 * panels — whitelisting a "suggested whitelist" row should make it
 * disappear from THAT panel's list immediately.
 */
export function removeContributorRows<
  TList extends Array<{ githubUsername: string }>,
>(targetUsernames: readonly string[]) {
  const targetSet = new Set(targetUsernames.map((u) => u.toLowerCase()))
  return (current: TList): TList =>
    current.filter(
      (row) => !targetSet.has(row.githubUsername.toLowerCase())
    ) as TList
}

/**
 * Match every cached `listContributors` variant for one repo.
 *
 * Walks the queryKey structurally (no JSON-stringify grep): the caller
 * passes the procedure prefix from `trpc.visibility.listContributors.queryKey()`,
 * we verify each cached key extends that prefix and that its trailing
 * input object has the matching `repoId`. Resilient to tRPC internals
 * changing — if the prefix shape ever changes, the type system catches
 * it at the call site.
 */
export function matchContributorsListForRepo(
  prefix: readonly unknown[],
  repoId: string
) {
  return (queryKey: QueryKey): boolean => {
    if (!Array.isArray(queryKey)) return false
    if (queryKey.length < prefix.length + 1) return false
    for (let i = 0; i < prefix.length; i++) {
      if (queryKey[i] !== prefix[i]) return false
    }
    const tail = queryKey[queryKey.length - 1]
    if (tail === null || typeof tail !== "object") return false
    const input = (tail as { input?: unknown }).input
    if (input === null || typeof input !== "object") return false
    return (input as { repoId?: unknown }).repoId === repoId
  }
}
