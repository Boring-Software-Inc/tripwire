import { describe, expect, it } from "vitest"
import {
  flipContributorStatuses,
  matchContributorsListForRepo,
  nextContributorStatus,
  removeContributorRows,
} from "./contributor-cache"

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

describe("matchContributorsListForRepo", () => {
  // The tRPC queryKey factory returns the procedure prefix. We use a
  // realistic stand-in here so the structural walk is exercised end-to-end.
  const prefix = ["visibility", "listContributors"] as const

  it("matches when the key starts with the prefix and input has the repoId", () => {
    const matcher = matchContributorsListForRepo(prefix, "repo-a")
    expect(
      matcher([...prefix, { input: { repoId: "repo-a", sort: "score" } }])
    ).toBe(true)
  })

  it("rejects when the repoId in the input does not match", () => {
    const matcher = matchContributorsListForRepo(prefix, "repo-a")
    expect(matcher([...prefix, { input: { repoId: "repo-b" } }])).toBe(false)
  })

  it("rejects when the key prefix differs from the procedure prefix", () => {
    const matcher = matchContributorsListForRepo(prefix, "repo-a")
    expect(
      matcher(["visibility", "otherQuery", { input: { repoId: "repo-a" } }])
    ).toBe(false)
  })

  it("rejects keys shorter than prefix + 1", () => {
    const matcher = matchContributorsListForRepo(prefix, "repo-a")
    expect(matcher(["listContributors"])).toBe(false)
    expect(matcher([...prefix])).toBe(false)
  })

  it("rejects when the tail is not an object", () => {
    const matcher = matchContributorsListForRepo(prefix, "repo-a")
    expect(matcher([...prefix, "repo-a"])).toBe(false)
    expect(matcher([...prefix, null])).toBe(false)
  })

  it("rejects when the tail object has no `input` field", () => {
    const matcher = matchContributorsListForRepo(prefix, "repo-a")
    expect(matcher([...prefix, { repoId: "repo-a" }])).toBe(false)
  })

  it("rejects non-array query keys", () => {
    const matcher = matchContributorsListForRepo(prefix, "repo-a")
    expect(matcher("some-string-key" as never)).toBe(false)
  })
})
