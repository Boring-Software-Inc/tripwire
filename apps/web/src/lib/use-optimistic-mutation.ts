import type { QueryKey } from "@tanstack/react-query"

/**
 * Subset of QueryClient we touch. Defined so tests can pass a stub
 * without standing up a real react-query setup.
 */
export type OptimisticPatchClient = {
  getQueryData(queryKey: QueryKey): unknown
  setQueryData(
    queryKey: QueryKey,
    updater: unknown | ((current: unknown) => unknown),
  ): unknown
  setQueriesData(
    filters: { predicate: (query: { queryKey: QueryKey }) => boolean },
    updater: unknown | ((current: unknown) => unknown),
  ): unknown
  getQueriesData(filters: {
    predicate: (query: { queryKey: QueryKey }) => boolean
  }): Array<[QueryKey, unknown]>
}

export type OptimisticPatchTarget =
  | { queryKey: QueryKey }
  | { predicate: (queryKey: QueryKey) => boolean }

export type OptimisticPatchHandle = {
  /** Restore every cache slot this patch touched to its prior value. */
  rollback: () => void
}

/**
 * Snapshot every matching cache slot, apply the updater, return a
 * rollback fn that restores the prior values exactly. Designed for
 * `useMutation({ onMutate / onError / onSuccess })` — capture the
 * handle from `onMutate`, call `handle.rollback()` from `onError`.
 *
 * - `{ queryKey }` patches one specific slot.
 * - `{ predicate }` walks every cached query and updates each match —
 *   use when multiple variants of a list (different sort/filter/page)
 *   need the same patch.
 *
 * Returning `current` from the updater (or never being called when
 * `current === undefined`) leaves the slot untouched.
 */
export function patchOptimistic<TData>(
  queryClient: OptimisticPatchClient,
  target: OptimisticPatchTarget,
  updater: (current: TData) => TData,
): OptimisticPatchHandle {
  const snapshots: Array<[QueryKey, unknown]> = []
  const safeUpdater = (current: unknown) => {
    if (current === undefined) return current
    return updater(current as TData)
  }

  if ("queryKey" in target) {
    snapshots.push([target.queryKey, queryClient.getQueryData(target.queryKey)])
    queryClient.setQueryData(target.queryKey, safeUpdater)
  } else {
    const matches = queryClient.getQueriesData({
      predicate: (query) => target.predicate(query.queryKey),
    })
    for (const [queryKey, data] of matches) {
      snapshots.push([queryKey, data])
    }
    queryClient.setQueriesData(
      { predicate: (query) => target.predicate(query.queryKey) },
      safeUpdater,
    )
  }

  return {
    rollback: () => {
      for (const [queryKey, data] of snapshots) {
        queryClient.setQueryData(queryKey, data)
      }
    },
  }
}

/**
 * Build a predicate that matches every tRPC `listContributors` cache
 * variant for one repo, regardless of search/sort/filter/pagination
 * params. Used by the bulk-action optimistic patches in visibility +
 * the contributor drawer — exact key isn't enough because the table
 * may have several open at once with different filters.
 */
export function matchesContributorsListForRepo(repoId: string) {
  return (queryKey: QueryKey): boolean => {
    if (!Array.isArray(queryKey) || queryKey.length < 2) return false
    const serialized = JSON.stringify(queryKey)
    return (
      serialized.includes("listContributors") &&
      serialized.includes(`"repoId":"${repoId}"`)
    )
  }
}

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
  action: ContributorAction,
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
        : row,
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
      (row) => !targetSet.has(row.githubUsername.toLowerCase()),
    ) as TList
}
