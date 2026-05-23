import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { createTokenBucket, withBucket } from "./rate-limit"

describe("createTokenBucket", () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  it("hands out up to `capacity` tokens before blocking", async () => {
    const bucket = createTokenBucket({ capacity: 3, refillPerSecond: 0 })
    expect(bucket.available()).toBe(3)
    await bucket.acquire()
    await bucket.acquire()
    await bucket.acquire()
    expect(bucket.available()).toBeCloseTo(0, 5)
  })

  it("refills based on elapsed time", async () => {
    const bucket = createTokenBucket({ capacity: 10, refillPerSecond: 5 })
    await bucket.acquire()
    await bucket.acquire()
    expect(bucket.available()).toBeCloseTo(8, 5)
    vi.advanceTimersByTime(1000)
    expect(bucket.available()).toBeCloseTo(10, 5)
  })

  it("cannot refill above capacity", async () => {
    const bucket = createTokenBucket({ capacity: 2, refillPerSecond: 100 })
    vi.advanceTimersByTime(60_000)
    expect(bucket.available()).toBe(2)
  })

  it("blocks when empty and resumes after refill", async () => {
    const bucket = createTokenBucket({ capacity: 1, refillPerSecond: 10 })
    await bucket.acquire()
    const promise = bucket.acquire()
    let resolved = false
    promise.then(() => {
      resolved = true
    })
    await vi.advanceTimersByTimeAsync(50)
    expect(resolved).toBe(false)
    await vi.advanceTimersByTimeAsync(200)
    await promise
    expect(resolved).toBe(true)
  })
})

describe("withBucket", () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  it("consumes one token per call and returns the wrapped value", async () => {
    const bucket = createTokenBucket({ capacity: 2, refillPerSecond: 0 })
    const value = await withBucket(bucket, async () => "ok")
    expect(value).toBe("ok")
    expect(bucket.available()).toBeCloseTo(1, 5)
  })
})
