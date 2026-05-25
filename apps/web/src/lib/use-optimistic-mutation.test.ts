import { describe, expect, it } from "vitest"
import {
  flipContributorStatuses,
  matchesContributorsListForRepo,
  type OptimisticPatchClient,
  nextContributorStatus,
  patchOptimistic,
  removeContributorRows,
} from "./use-optimistic-mutation"

/**
 * Minimal in-memory QueryClient surface. Keys are JSON-stringified so
 * tuple-shaped keys can index into a plain Map; we keep a parallel map
 * of the original tuples for predicate walks + rollback round-trips.
 */
function createStubClient(initial: Array<[readonly unknown[], unknown]> = []) {
  const data = new Map<string, unknown>()
  const keyByJson = new Map<string, readonly unknown[]>()
  for (const [key, value] of initial) {
    const json = JSON.stringify(key)
    data.set(json, value)
    keyByJson.set(json, key)
  }

  const applyUpdater = (json: string, updater: unknown) => {
    const next =
      typeof updater === "function"
        ? (updater as (current: unknown) => unknown)(data.get(json))
        : updater
    if (next === undefined) return
    data.set(json, next)
  }

  const client: OptimisticPatchClient = {
    getQueryData(queryKey) {
      return data.get(JSON.stringify(queryKey))
    },
    setQueryData(queryKey, updater) {
      const json = JSON.stringify(queryKey)
      keyByJson.set(json, queryKey as readonly unknown[])
      applyUpdater(json, updater)
      return data.get(json)
    },
    getQueriesData({ predicate }) {
      const matches: Array<[readonly unknown[], unknown]> = []
      for (const [json, queryKey] of keyByJson) {
        if (predicate({ queryKey })) {
          matches.push([queryKey, data.get(json)])
        }
      }
      return matches
    },
    setQueriesData({ predicate }, updater) {
      for (const [json, queryKey] of keyByJson) {
        if (predicate({ queryKey })) {
          applyUpdater(json, updater)
        }
      }
      return undefined
    },
  }
  return { client, data }
}

describe("patchOptimistic — exact queryKey", () => {
  it("applies the updater to the named slot", () => {
    const { client, data } = createStubClient([[["repos", "abc"], { count: 3 }]])
    patchOptimistic<{ count: number }>(
      client,
      { queryKey: ["repos", "abc"] },
      (current) => ({ count: current.count + 1 }),
    )
    expect(data.get(JSON.stringify(["repos", "abc"]))).toEqual({ count: 4 })
  })

  it("skips slots that are not loaded yet", () => {
    const { client, data } = createStubClient()
    patchOptimistic<{ count: number }>(
      client,
      { queryKey: ["repos", "missing"] },
      (current) => ({ count: current.count + 1 }),
    )
    // setQueryData still gets called, but the safe-updater swallows undefined.
    expect(data.get(JSON.stringify(["repos", "missing"]))).toBeUndefined()
  })

  it("rollback restores the prior value exactly", () => {
    const { client, data } = createStubClient([
      [["repos", "abc"], { count: 3 }],
    ])
    const { rollback } = patchOptimistic<{ count: number }>(
      client,
      { queryKey: ["repos", "abc"] },
      (current) => ({ count: current.count + 100 }),
    )
    expect(data.get(JSON.stringify(["repos", "abc"]))).toEqual({ count: 103 })
    rollback()
    expect(data.get(JSON.stringify(["repos", "abc"]))).toEqual({ count: 3 })
  })
})

describe("patchOptimistic — predicate", () => {
  it("applies the updater to every matching slot", () => {
    const { client, data } = createStubClient([
      [["list", { repoId: "r1" }], { items: [1] }],
      [["list", { repoId: "r1", sort: "name" }], { items: [2] }],
      [["list", { repoId: "r2" }], { items: [99] }],
    ])
    patchOptimistic<{ items: number[] }>(
      client,
      {
        predicate: (key) =>
          Array.isArray(key) && JSON.stringify(key).includes(`"repoId":"r1"`),
      },
      (current) => ({ items: [...current.items, 42] }),
    )
    expect(data.get(JSON.stringify(["list", { repoId: "r1" }]))).toEqual({
      items: [1, 42],
    })
    expect(
      data.get(JSON.stringify(["list", { repoId: "r1", sort: "name" }])),
    ).toEqual({ items: [2, 42] })
    expect(data.get(JSON.stringify(["list", { repoId: "r2" }]))).toEqual({
      items: [99],
    })
  })

  it("rollback restores every touched slot to its prior value", () => {
    const initial: Array<[readonly unknown[], unknown]> = [
      [["list", { repoId: "r1" }], { items: [1] }],
      [["list", { repoId: "r1", sort: "name" }], { items: [2] }],
    ]
    const { client, data } = createStubClient(initial)
    const { rollback } = patchOptimistic<{ items: number[] }>(
      client,
      {
        predicate: (key) =>
          Array.isArray(key) && JSON.stringify(key).includes(`"repoId":"r1"`),
      },
      (current) => ({ items: [...current.items, 999] }),
    )
    rollback()
    for (const [key, value] of initial) {
      expect(data.get(JSON.stringify(key))).toEqual(value)
    }
  })
})

describe("matchesContributorsListForRepo", () => {
  it("matches listContributors keys with the requested repoId", () => {
    const matcher = matchesContributorsListForRepo("repo-a")
    expect(
      matcher([
        "visibility",
        "listContributors",
        { input: { repoId: "repo-a", sort: "score" } },
      ]),
    ).toBe(true)
  })

  it("rejects listContributors keys for a different repo", () => {
    const matcher = matchesContributorsListForRepo("repo-a")
    expect(
      matcher([
        "visibility",
        "listContributors",
        { input: { repoId: "repo-b" } },
      ]),
    ).toBe(false)
  })

  it("rejects keys for unrelated queries even when the repoId substring matches", () => {
    const matcher = matchesContributorsListForRepo("repo-a")
    expect(matcher(["visibility", "otherQuery", { repoId: "repo-a" }])).toBe(
      false,
    )
  })

  it("rejects short keys", () => {
    const matcher = matchesContributorsListForRepo("repo-a")
    expect(matcher(["listContributors"])).toBe(false)
  })
})

describe("nextContributorStatus", () => {
  it("maps whitelist verbs to whitelisted", () => {
    expect(nextContributorStatus("whitelist")).toBe("whitelisted")
  })
  it("maps blacklist verbs to blacklisted", () => {
    expect(nextContributorStatus("blacklist")).toBe("blacklisted")
  })
  it("maps both remove verbs back to normal", () => {
    expect(nextContributorStatus("removeWhitelist")).toBe("normal")
    expect(nextContributorStatus("removeBlacklist")).toBe("normal")
  })
})

describe("flipContributorStatuses", () => {
  it("flips only rows whose username matches (case-insensitive)", () => {
    const list = {
      items: [
        { githubUsername: "Alice", status: "normal" },
        { githubUsername: "bob", status: "normal" },
      ],
      total: 2,
    }
    const updated = flipContributorStatuses(["alice"], "whitelisted")(list)
    expect(updated.items[0].status).toBe("whitelisted")
    expect(updated.items[1].status).toBe("normal")
  })

  it("returns a new array/object — does not mutate input", () => {
    const list = {
      items: [{ githubUsername: "alice", status: "normal" }],
    }
    const updated = flipContributorStatuses(["alice"], "whitelisted")(list)
    expect(updated).not.toBe(list)
    expect(updated.items).not.toBe(list.items)
    expect(list.items[0].status).toBe("normal")
  })
})

describe("removeContributorRows", () => {
  it("drops only rows whose username matches", () => {
    const rows = [
      { githubUsername: "alice" },
      { githubUsername: "bob" },
      { githubUsername: "Carol" },
    ]
    expect(removeContributorRows(["carol"])(rows)).toEqual([
      { githubUsername: "alice" },
      { githubUsername: "bob" },
    ])
  })

  it("returns an empty array when nothing remains", () => {
    const rows = [{ githubUsername: "alice" }]
    expect(removeContributorRows(["alice"])(rows)).toEqual([])
  })
})
