import {
  useQuery,
  type UseQueryOptions,
  type UseQueryResult,
} from "@tanstack/react-query"
import { useMemo } from "react"
import { useGitHubSignalStream } from "./use-signal-stream"

/**
 * Wraps a query with:
 * 1. `meta.persist: true` — successful payloads hydrate from
 *    localStorage on cold load (see `integrations/tanstack-query/
 *    persistence.ts`).
 * 2. A `useGitHubSignalStream` subscription — webhooks bumping any of
 *    `signalKeys` invalidate this query sub-second over SSE with a
 *    20s poll safety net.
 *
 * Accepts the wider `UseQueryOptions` shape directly so tRPC's
 * `queryOptions(...)` output (which extends it) flows through with
 * full inference. `meta` is merged so caller-provided metadata is kept.
 */
export function useLiveGitHubQuery<
  TData,
  TError = Error,
  TQueryKey extends readonly unknown[] = readonly unknown[],
>(
  options: UseQueryOptions<TData, TError, TData, TQueryKey>,
  signalKeys: readonly string[],
): UseQueryResult<TData, TError> {
  const merged = useMemo(
    () => ({
      ...options,
      meta: { ...(options.meta ?? {}), persist: true } as Record<
        string,
        unknown
      >,
    }),
    [options],
  )

  const signalKeysKey = signalKeys.join(",")
  const streamTargets = useMemo(
    () => [{ queryKey: options.queryKey, signalKeys: [...signalKeys] }],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [options.queryKey, signalKeysKey],
  )
  useGitHubSignalStream(streamTargets)

  return useQuery(merged) as UseQueryResult<TData, TError>
}
