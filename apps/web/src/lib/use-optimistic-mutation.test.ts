import { describe, expect, it } from "vitest"
import {
  type OptimisticPatchClient,
  patchOptimistic,
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
    const { client, data } = createStubClient([
      [["repos", "abc"], { count: 3 }],
    ])
    patchOptimistic<{ count: number }>(
      client,
      { queryKey: ["repos", "abc"] },
      (current) => ({ count: current.count + 1 })
    )
    expect(data.get(JSON.stringify(["repos", "abc"]))).toEqual({ count: 4 })
  })

  it("skips slots that are not loaded yet", () => {
    const { client, data } = createStubClient()
    patchOptimistic<{ count: number }>(
      client,
      { queryKey: ["repos", "missing"] },
      (current) => ({ count: current.count + 1 })
    )
    expect(data.get(JSON.stringify(["repos", "missing"]))).toBeUndefined()
  })

  it("rollback restores the prior value exactly", () => {
    const { client, data } = createStubClient([
      [["repos", "abc"], { count: 3 }],
    ])
    const { rollback } = patchOptimistic<{ count: number }>(
      client,
      { queryKey: ["repos", "abc"] },
      (current) => ({ count: current.count + 100 })
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
          Array.isArray(key) &&
          typeof key[1] === "object" &&
          key[1] !== null &&
          (key[1] as { repoId?: unknown }).repoId === "r1",
      },
      (current) => ({ items: [...current.items, 42] })
    )
    expect(data.get(JSON.stringify(["list", { repoId: "r1" }]))).toEqual({
      items: [1, 42],
    })
    expect(
      data.get(JSON.stringify(["list", { repoId: "r1", sort: "name" }]))
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
          Array.isArray(key) &&
          typeof key[1] === "object" &&
          key[1] !== null &&
          (key[1] as { repoId?: unknown }).repoId === "r1",
      },
      (current) => ({ items: [...current.items, 999] })
    )
    rollback()
    for (const [key, value] of initial) {
      expect(data.get(JSON.stringify(key))).toEqual(value)
    }
  })
})
