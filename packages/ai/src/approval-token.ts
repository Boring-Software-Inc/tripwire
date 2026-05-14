import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import { env } from "@tripwire/env/server";

/**
 * Signed token for AI tool approvals.
 *
 * When the model proposes a `needsApproval` tool, the server signs an HMAC
 * over the tool-call's identity (toolCallId, userId, conversationId, repoId,
 * tool name, and a hash of the arguments). The token is shipped to the
 * client as the approval id and round-trips back when the user approves.
 *
 * On the next request, executeApprovedTools re-derives the expected payload
 * (from the message, session, args the client sent) and verifies the
 * signature. This prevents a malicious client from POSTing a synthetic
 * "approval-responded" tool-call to coerce the server into executing tools
 * the model never proposed.
 *
 * Format: `${base64url(JSON.stringify(payload))}.${base64url(HMAC_SHA256(secret, payload))}`
 */

const TOKEN_TTL_SECONDS = 60 * 60; // 1 hour

export interface ApprovalTokenPayload {
	toolCallId: string;
	userId: string;
	conversationId: string;
	repoId: string;
	name: string;
	argsHash: string;
	exp: number;
}

function getSecret(): string {
	const secret = env.BETTER_AUTH_SECRET;
	if (!secret) {
		throw new Error(
			"BETTER_AUTH_SECRET is not configured — cannot sign approval tokens",
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
 * Canonical JSON: deterministic key order so the same logical args always
 * hash to the same string regardless of property insertion order.
 */
function canonicalJSON(value: unknown): string {
	if (value === null || typeof value !== "object") {
		return JSON.stringify(value);
	}
	if (Array.isArray(value)) {
		return `[${value.map((v) => canonicalJSON(v)).join(",")}]`;
	}
	const obj = value as Record<string, unknown>;
	const keys = Object.keys(obj).sort();
	const body = keys
		.map((k) => `${JSON.stringify(k)}:${canonicalJSON(obj[k])}`)
		.join(",");
	return `{${body}}`;
}

export function hashArgs(args: unknown): string {
	return createHash("sha256").update(canonicalJSON(args)).digest("hex");
}

export function signApprovalToken(
	payload: Omit<ApprovalTokenPayload, "exp"> & { exp?: number },
): string {
	const exp = payload.exp ?? Math.floor(Date.now() / 1000) + TOKEN_TTL_SECONDS;
	const fullPayload: ApprovalTokenPayload = {
		toolCallId: payload.toolCallId,
		userId: payload.userId,
		conversationId: payload.conversationId,
		repoId: payload.repoId,
		name: payload.name,
		argsHash: payload.argsHash,
		exp,
	};
	const encoded = b64urlEncode(JSON.stringify(fullPayload));
	const signature = sign(encoded);
	return `${encoded}.${signature}`;
}

export type ApprovalTokenExpected = Omit<ApprovalTokenPayload, "exp">;

/**
 * Verify a signed approval token. Returns true iff:
 *   - format is well-formed
 *   - HMAC signature matches (timing-safe comparison)
 *   - exp is in the future
 *   - every field in `expected` matches the payload (including argsHash,
 *     so re-ordering or mutating args invalidates the token)
 */
export function verifyApprovalToken(
	token: string | null | undefined,
	expected: ApprovalTokenExpected,
): boolean {
	if (!token || typeof token !== "string") return false;

	const idx = token.lastIndexOf(".");
	if (idx <= 0 || idx >= token.length - 1) return false;

	const encoded = token.slice(0, idx);
	const providedSig = token.slice(idx + 1);

	let expectedSig: string;
	try {
		expectedSig = sign(encoded);
	} catch {
		return false;
	}

	const a = Buffer.from(providedSig);
	const b = Buffer.from(expectedSig);
	if (a.length !== b.length) return false;
	if (!timingSafeEqual(a, b)) return false;

	let payload: ApprovalTokenPayload;
	try {
		const json = b64urlDecode(encoded).toString("utf8");
		payload = JSON.parse(json) as ApprovalTokenPayload;
	} catch {
		return false;
	}

	if (typeof payload.exp !== "number") return false;
	if (payload.exp < Math.floor(Date.now() / 1000)) return false;

	if (payload.toolCallId !== expected.toolCallId) return false;
	if (payload.userId !== expected.userId) return false;
	if (payload.conversationId !== expected.conversationId) return false;
	if (payload.repoId !== expected.repoId) return false;
	if (payload.name !== expected.name) return false;
	if (payload.argsHash !== expected.argsHash) return false;

	return true;
}
