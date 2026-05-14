import { Ratelimit } from "@unkey/ratelimit";
import { env } from "@tripwire/env/server";
import { createError, EvlogError } from "evlog";

// Throw a structured evlog error so any host (tRPC / fetch route / CLI) can
// surface it. The web app's tRPC errorFormatter maps EvlogError onto
// shape.data so clients see `code: "ratelimit.exceeded"`.
const RATE_LIMITED = (message: string) =>
	createError({
		code: "ratelimit.exceeded",
		status: 429,
		message,
	});

// ---------------------------------------------------------------------------
// Production guard: refuse to start if rate limiting isn't configured
// ---------------------------------------------------------------------------

if (env.NODE_ENV === "production" && !env.UNKEY_ROOT_KEY) {
	throw new Error("UNKEY_ROOT_KEY is required in production");
}

// ---------------------------------------------------------------------------
// Namespace configs
// ---------------------------------------------------------------------------

const NAMESPACES = {
	/** Joining the waitlist */
	waitlist: { limit: 3, duration: "60s" as const },
} as const;

export type RatelimitNamespace = keyof typeof NAMESPACES;

// ---------------------------------------------------------------------------
// Limiter cache
// ---------------------------------------------------------------------------

const limiterCache = new Map<string, Ratelimit>();

function getLimiter(namespace: RatelimitNamespace): Ratelimit | null {
	if (!env.UNKEY_ROOT_KEY) return null;

	const cached = limiterCache.get(namespace);
	if (cached) return cached;

	const config = NAMESPACES[namespace];
	const limiter = new Ratelimit({
		rootKey: env.UNKEY_ROOT_KEY,
		namespace,
		limit: config.limit,
		duration: config.duration,
	});

	limiterCache.set(namespace, limiter);
	return limiter;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Check rate limit for a given namespace and identifier.
 *
 * Returns `{ success: true, remaining }` if allowed.
 * Throws `EvlogError` with code `ratelimit.exceeded` (status 429) if denied.
 * If Unkey is not configured (no `UNKEY_ROOT_KEY`), silently allows all.
 */
export async function checkRateLimit(
	namespace: RatelimitNamespace,
	identifier: string,
): Promise<{ success: true; remaining: number }> {
	const limiter = getLimiter(namespace);

	// If Unkey is not configured, allow all (development fallback)
	if (!limiter) {
		return { success: true, remaining: -1 };
	}

	try {
		const result = await limiter.limit(identifier);

		if (!result.success) {
			throw RATE_LIMITED("Slow down! Too many requests.");
		}

		return { success: true, remaining: result.remaining };
	} catch (err) {
		// Re-throw our own rate-limit errors
		if (err instanceof EvlogError && err.code === "ratelimit.exceeded") throw err;
		// In production, fail closed: surface infrastructure failures as 429.
		if (env.NODE_ENV === "production") {
			throw RATE_LIMITED("Rate limit unavailable — try again shortly.");
		}
		// In dev, silently allow on infrastructure failures
		return { success: true, remaining: -1 };
	}
}
