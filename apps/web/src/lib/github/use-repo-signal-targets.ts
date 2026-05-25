import type { QueryKey } from "@tanstack/react-query"
import { useMemo } from "react"
import { githubRevalidationSignalKeys } from "./revalidation"
import type { GitHubSignalStreamTarget } from "./use-signal-stream"

/**
 * Build the `repo:owner/name` signal key list for one repo. Returns `[]`
 * when `fullName` is missing or unparseable so the caller can pass the
 * result straight to `useGitHubSignalStream`, which no-ops on an empty
 * key list.
 */
export function useRepoSignalKeys(
  repoFullName: string | null | undefined
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
 * same key set: the repo signal (when `repoFullName` parses) plus any
 * extra keys. Composes on `useRepoSignalKeys` so the parse-and-guard
 * lives in exactly one place.
 *
 * Returns `[]` when no signal keys would apply (no repo AND no extras)
 * — `useGitHubSignalStream` no-ops on an empty list.
 */
export function useRepoSignalTargets(
  repoFullName: string | null | undefined,
  queryKeys: readonly QueryKey[],
  extraSignalKeys: readonly string[] = []
): GitHubSignalStreamTarget[] {
  const repoKeys = useRepoSignalKeys(repoFullName)
  const queryKeysKey = JSON.stringify(queryKeys)
  const extraKeysKey = extraSignalKeys.join(" ")
  return useMemo(() => {
    const signalKeys = [...repoKeys, ...extraSignalKeys]
    if (signalKeys.length === 0) return []
    return queryKeys.map((queryKey) => ({ queryKey, signalKeys }))
  }, [repoKeys, queryKeysKey, extraKeysKey])
}
