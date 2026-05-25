import type { QueryKey } from "@tanstack/react-query"
import { useMemo } from "react"
import { githubRevalidationSignalKeys } from "./revalidation"
import type { GitHubSignalStreamTarget } from "./use-signal-stream"

/**
 * Build the `repo:owner/name` signal key list for one repo. Returns `[]`
 * when `fullName` is missing or unparseable so the caller can pass the
 * result straight to `useLiveGitHubQuery` / `useGitHubSignalStream`,
 * both of which no-op on an empty key list.
 */
export function useRepoSignalKeys(
  repoFullName: string | null | undefined,
): readonly string[] {
  return useMemo(() => {
    if (!repoFullName) return []
    const [owner, name] = repoFullName.split("/")
    if (!owner || !name) return []
    return [githubRevalidationSignalKeys.repo({ owner, repo: name })]
  }, [repoFullName])
}

/**
 * Build `useGitHubSignalStream` target rows. Every target shares the
 * same key set:
 *   - `repo:owner/name`  (only when `repoFullName` parses cleanly)
 *   - `...extraSignalKeys`  (always included)
 *
 * Returns `[]` only when no signal keys at all would apply (no repo
 * AND no extras) — `useGitHubSignalStream` no-ops on an empty list.
 */
export function useRepoSignalTargets(
  repoFullName: string | null | undefined,
  queryKeys: readonly QueryKey[],
  extraSignalKeys: readonly string[] = [],
): GitHubSignalStreamTarget[] {
  const queryKeysKey = JSON.stringify(queryKeys)
  const extraKeysKey = extraSignalKeys.join(" ")
  return useMemo(() => {
    const signalKeys: string[] = []
    if (repoFullName) {
      const [owner, name] = repoFullName.split("/")
      if (owner && name) {
        signalKeys.push(
          githubRevalidationSignalKeys.repo({ owner, repo: name }),
        )
      }
    }
    signalKeys.push(...extraSignalKeys)
    if (signalKeys.length === 0) return []
    return queryKeys.map((queryKey) => ({ queryKey, signalKeys }))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [repoFullName, queryKeysKey, extraKeysKey])
}
