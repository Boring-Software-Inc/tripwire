export interface TokenBucketOptions {
  capacity: number
  refillPerSecond: number
}

export interface TokenBucket {
  acquire(): Promise<void>
  available(): number
}

export function createTokenBucket(opts: TokenBucketOptions): TokenBucket {
  let tokens = opts.capacity
  let lastRefill = Date.now()

  function refill() {
    const now = Date.now()
    const elapsed = (now - lastRefill) / 1000
    if (elapsed <= 0) return
    tokens = Math.min(opts.capacity, tokens + elapsed * opts.refillPerSecond)
    lastRefill = now
  }

  return {
    async acquire() {
      refill()
      while (tokens < 1) {
        const deficit = 1 - tokens
        const waitMs = Math.ceil((deficit / opts.refillPerSecond) * 1000)
        await sleep(Math.min(waitMs, 1000))
        refill()
      }
      tokens -= 1
    },
    available() {
      refill()
      return tokens
    },
  }
}

export function githubBucket(): TokenBucket {
  return createTokenBucket({ capacity: 5000, refillPerSecond: 5000 / 3600 })
}

export async function withBucket<T>(
  bucket: TokenBucket,
  fn: () => Promise<T>
): Promise<T> {
  await bucket.acquire()
  return fn()
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}
