import type { QueryKey } from "@tanstack/react-query"

/**
 * Subset of QueryClient we touch. Defined so tests can pass a stub
 * without standing up a real react-query setup.
 */
export type OptimisticPatchClient = {
  getQueryData(queryKey: QueryKey): unknown
  setQueryData(
    queryKey: QueryKey,
    updater: unknown | ((current: unknown) => unknown)
  ): unknown
  setQueriesData(
    filters: { predicate: (query: { queryKey: QueryKey }) => boolean },
    updater: unknown | ((current: unknown) => unknown)
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
 * The updater is called only when the slot has a value; loaded slots
 * pass through, empty slots are left alone.
 */
export function patchOptimistic<TData>(
  queryClient: OptimisticPatchClient,
  target: OptimisticPatchTarget,
  updater: (current: TData) => TData
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
      safeUpdater
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
