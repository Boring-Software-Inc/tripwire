import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { and, eq, gt, isNull, lt } from "drizzle-orm";
import { db } from "@tripwire/db/client";
import { installStates } from "@tripwire/db";
import { env } from "@tripwire/env/server";

/**
 * Signed state parameter for the GitHub App install OAuth flow.
 *
 * Mitigates two attack classes:
 *  1. CSRF — an attacker can't trick a logged-in victim into binding
 *     the attacker's GitHub installation to the victim's account
 *     because the state is bound to userId.
 *  2. Replay — state carries an `exp` timestamp and the callback consumes the
 *     persisted nonce before accepting an installation.
 *
 * Format: `${base64url(JSON.stringify({ userId, nonce, exp }))}.${base64url(HMAC_SHA256(secret, payload))}`
 */

const STATE_TTL_SECONDS = 600; // 10 minutes

export const INSTALL_STATE_COOKIE = "__tripwire_install_state";
export const INSTALL_STATE_COOKIE_MAX_AGE = STATE_TTL_SECONDS;

interface StatePayload {
	userId: string;
	nonce: string;
	exp: number;
}

function getSecret(): string {
	const secret = env.BETTER_AUTH_SECRET;
	if (!secret) {
		throw new Error(
			"BETTER_AUTH_SECRET is not configured — cannot sign install state",
		);
	}
	return secret;
}

function b64urlEncode(buf: Buffer | string): string {
	const b = typeof buf === "string" ? Buffer.from(buf, "utf8") : buf;
	return b
		.toString("base64")
		.replace(/\+/g, "-")
		.replace(/\//g, "_")
		.replace(/=+$/, "");
}

function b64urlDecode(s: string): Buffer {
	const pad = s.length % 4 === 0 ? "" : "=".repeat(4 - (s.length % 4));
	return Buffer.from(s.replace(/-/g, "+").replace(/_/g, "/") + pad, "base64");
}

function sign(payload: string): string {
	return b64urlEncode(
		createHmac("sha256", getSecret()).update(payload).digest(),
	);
}

/**
 * Generate a signed state value bound to `userId`.
 * Returns the value to put in the `state` query param of the install URL
 * AND the cookie Max-Age the caller should use when setting the
 * `__tripwire_install_state` cookie.
 */
export function signInstallState(userId: string): {
	value: string;
	cookieMaxAge: number;
	nonce: string;
	expiresAt: Date;
} {
	const exp = Math.floor(Date.now() / 1000) + STATE_TTL_SECONDS;
	const nonce = randomBytes(16).toString("hex");
	const payload: StatePayload = { userId, nonce, exp };
	const encoded = b64urlEncode(JSON.stringify(payload));
	const signature = sign(encoded);
	return {
		value: `${encoded}.${signature}`,
		cookieMaxAge: STATE_TTL_SECONDS,
		nonce,
		expiresAt: new Date(exp * 1000),
	};
}

/**
 * Generate and persist a state nonce so the callback can consume it exactly once.
 */
export async function createInstallState(userId: string): Promise<{
	value: string;
	cookieMaxAge: number;
}> {
	const state = signInstallState(userId);
	const now = new Date();

	await db.delete(installStates).where(lt(installStates.expiresAt, now));
	await db.insert(installStates).values({
		nonce: state.nonce,
		userId,
		expiresAt: state.expiresAt,
	});

	return {
		value: state.value,
		cookieMaxAge: state.cookieMaxAge,
	};
}

/**
 * Verify a signed state value. Returns true iff:
 *   - the signature is valid (constant-time comparison)
 *   - the embedded userId matches the expected userId
 *   - the embedded exp is in the future
 */
export function verifyInstallState(
	value: string | null | undefined,
	userId: string,
): boolean {
	return readInstallStatePayload(value, userId) !== null;
}

/**
 * Verify and consume a persisted install-state nonce.
 */
export async function consumeInstallState(
	value: string | null | undefined,
	userId: string,
): Promise<boolean> {
	const payload = readInstallStatePayload(value, userId);
	if (!payload) return false;

	const now = new Date();
	const [consumed] = await db
		.update(installStates)
		.set({ consumedAt: now })
		.where(
			and(
				eq(installStates.nonce, payload.nonce),
				eq(installStates.userId, userId),
				isNull(installStates.consumedAt),
				gt(installStates.expiresAt, now),
			),
		)
		.returning({ nonce: installStates.nonce });

	return !!consumed;
}

function readInstallStatePayload(
	value: string | null | undefined,
	userId: string,
): StatePayload | null {
	if (!value || typeof value !== "string") return null;

	const idx = value.lastIndexOf(".");
	if (idx <= 0 || idx >= value.length - 1) return null;

	const encoded = value.slice(0, idx);
	const providedSig = value.slice(idx + 1);

	let expectedSig: string;
	try {
		expectedSig = sign(encoded);
	} catch {
		return null;
	}

	const a = Buffer.from(providedSig);
	const b = Buffer.from(expectedSig);
	if (a.length !== b.length) return null;
	if (!timingSafeEqual(a, b)) return null;

	let payload: StatePayload;
	try {
		const json = b64urlDecode(encoded).toString("utf8");
		payload = JSON.parse(json) as StatePayload;
	} catch {
		return null;
	}

	if (typeof payload.userId !== "string" || payload.userId !== userId) {
		return null;
	}
	if (typeof payload.nonce !== "string" || payload.nonce.length === 0) {
		return null;
	}
	if (typeof payload.exp !== "number") return null;
	if (payload.exp < Math.floor(Date.now() / 1000)) return null;

	return payload;
}
