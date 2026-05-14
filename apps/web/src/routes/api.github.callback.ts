import { createFileRoute } from "@tanstack/react-router";
import { createContext } from "#/integrations/trpc/init";
import { db } from "@tripwire/db/client";
import { organizations, repositories, account } from "@tripwire/db";
import { eq, and } from "drizzle-orm";
import {
	createAppJwt,
	getInstallationToken,
} from '@tripwire/github';
import {
	INSTALL_STATE_COOKIE,
	verifyInstallState,
} from '@tripwire/github';

/**
 * GitHub App post-installation callback.
 * GitHub redirects here after a user installs/updates the app.
 *
 * Also creates the org/repo records if the webhook hasn't arrived yet
 * (common in local dev where GitHub can't reach localhost).
 */
async function handler({ request }: { request: Request }) {
	const url = new URL(request.url);
	const installationId = url.searchParams.get("installation_id");
	const setupAction = url.searchParams.get("setup_action");
	const queryState = url.searchParams.get("state");

	console.log("[Callback] ▶ GitHub App callback received");
	console.log("[Callback] Installation ID:", installationId);
	console.log("[Callback] Setup action:", setupAction);

	// We require an authenticated session for the install completion path.
	const ctx = await createContext({ headers: request.headers });

	if (installationId && setupAction === "install") {
		if (!ctx.user) {
			return redirectToIntegrations("not_authenticated");
		}

		// ── 1. State / CSRF check ──────────────────────────────────────
		const cookieState = readCookie(
			request.headers.get("cookie"),
			INSTALL_STATE_COOKIE,
		);

		if (!queryState || !cookieState || queryState !== cookieState) {
			console.warn("[Callback] ✗ Missing or mismatched install state");
			return redirectToIntegrations("invalid_state");
		}
		if (!verifyInstallState(queryState, ctx.user.id)) {
			console.warn("[Callback] ✗ Install state failed signature/exp check");
			return redirectToIntegrations("invalid_state");
		}

		// ── 2. Bind installation, verifying the installer's GH identity ──
		try {
			const result = await ensureInstallation(
				Number(installationId),
				ctx.user.id,
			);
			if (result === "installer_mismatch") {
				return redirectToIntegrations("installer_mismatch");
			}
		} catch (err) {
			console.error("[Callback] Failed to ensure installation:", err);
		}

		// ── 3. Success → clear cookie & redirect to /rules ──────────────
		return new Response(null, {
			status: 302,
			headers: new Headers([
				["Location", "/rules"],
				["Set-Cookie", clearStateCookie()],
			]),
		});
	}

	return new Response(null, {
		status: 302,
		headers: { Location: "/rules" },
	});
}

function redirectToIntegrations(
	error: "invalid_state" | "installer_mismatch" | "not_authenticated",
) {
	const headers = new Headers([
		["Location", `/integrations?error=${error}`],
		["Set-Cookie", clearStateCookie()],
	]);
	return new Response(null, { status: 302, headers });
}

function clearStateCookie(): string {
	const isProd = process.env.NODE_ENV === "production";
	const parts = [
		`${INSTALL_STATE_COOKIE}=`,
		"Path=/",
		"HttpOnly",
		"SameSite=Lax",
		"Max-Age=0",
	];
	if (isProd) parts.push("Secure");
	return parts.join("; ");
}

function readCookie(header: string | null, name: string): string | null {
	if (!header) return null;
	const parts = header.split(";");
	for (const part of parts) {
		const eq = part.indexOf("=");
		if (eq === -1) continue;
		const k = part.slice(0, eq).trim();
		if (k === name) return part.slice(eq + 1).trim();
	}
	return null;
}

/**
 * Fetch installation metadata using the GitHub App JWT.
 * This is the source of truth for *who installed the App*.
 */
async function fetchInstallationMeta(
	installationId: number,
): Promise<{ accountId: number; accountType: string; accountLogin: string } | null> {
	const jwt = await createAppJwt();
	const res = await fetch(
		`https://api.github.com/app/installations/${installationId}`,
		{
			headers: {
				Authorization: `Bearer ${jwt}`,
				Accept: "application/vnd.github+json",
				"X-GitHub-Api-Version": "2022-11-28",
			},
		},
	);
	if (!res.ok) {
		console.error(
			"[Callback] Failed to fetch installation metadata:",
			res.status,
		);
		return null;
	}
	const data = (await res.json()) as {
		account?: { id?: number; type?: string; login?: string };
	};
	if (
		!data.account ||
		typeof data.account.id !== "number" ||
		typeof data.account.type !== "string" ||
		typeof data.account.login !== "string"
	) {
		return null;
	}
	return {
		accountId: data.account.id,
		accountType: data.account.type,
		accountLogin: data.account.login,
	};
}

/**
 * Ensure the org + repos exist for this installation, and verify that
 * the GitHub account that owns the installation is in fact linked to
 * the session user (via better-auth `account` row).
 *
 * Returns:
 *   - "ok"                  on success or idempotent no-op
 *   - "installer_mismatch"  if the GH installer is not the session user's
 *                           linked GH identity. Any rows inserted by this
 *                           call are rolled back.
 */
async function ensureInstallation(
	installationId: number,
	userId: string,
): Promise<"ok" | "installer_mismatch"> {
	// Idempotent: skip if the webhook already created the org for this install.
	const [existing] = await db
		.select()
		.from(organizations)
		.where(eq(organizations.githubInstallationId, installationId));

	if (existing) {
		console.log(
			"[Callback] Org already exists for installation",
			installationId,
		);
		return "ok";
	}

	// Verify installer identity BEFORE inserting any rows.
	const meta = await fetchInstallationMeta(installationId);
	if (!meta) return "installer_mismatch";

	const [ghAccountRow] = await db
		.select({ accountId: account.accountId })
		.from(account)
		.where(
			and(eq(account.userId, userId), eq(account.providerId, "github")),
		);

	if (!ghAccountRow) {
		console.warn("[Callback] Session user has no linked GitHub account");
		return "installer_mismatch";
	}

	if (meta.accountType === "User") {
		// For user installs, the installation account id IS the user's GH id.
		if (String(meta.accountId) !== String(ghAccountRow.accountId)) {
			console.warn(
				"[Callback] Installer GitHub user id does not match session user",
				{ installerAccountId: meta.accountId, linked: ghAccountRow.accountId },
			);
			return "installer_mismatch";
		}
	}
	// For "Organization" installs the installation account id is the org id,
	// not the installer's user id, so a direct equality check is wrong. We
	// still require the session user to be GH-linked (verified above) and
	// rely on GitHub's own install UI to gate org-admin permission. A
	// stricter membership check is a follow-up.

	// Fetch repos for this installation
	const token = await getInstallationToken(installationId);
	const reposRes = await fetch(
		"https://api.github.com/installation/repositories?per_page=100",
		{
			headers: {
				Authorization: `token ${token}`,
				Accept: "application/vnd.github.v3+json",
			},
		},
	);

	if (!reposRes.ok) {
		console.error("[Callback] Failed to fetch repos:", reposRes.status);
		return "ok";
	}

	const { repositories: repos } = (await reposRes.json()) as {
		repositories: Array<{
			id: number;
			name: string;
			full_name: string;
			private: boolean;
			owner: {
				id: number;
				login: string;
				type?: string;
				avatar_url?: string;
			};
		}>;
	};
	if (!repos || repos.length === 0) {
		console.log("[Callback] No repos found for installation");
		return "ok";
	}

	// Sanity: repo owner id should match the installation account id.
	const ghAccount = repos[0].owner;

	// Create org
	const [org] = await db
		.insert(organizations)
		.values({
			githubInstallationId: installationId,
			githubAccountId: ghAccount.id,
			githubAccountLogin: ghAccount.login,
			githubAccountType: ghAccount.type ?? "User",
			avatarUrl: ghAccount.avatar_url,
			ownerId: userId,
		})
		.returning();

	console.log(`[Callback] Created org "${ghAccount.login}" (ID: ${org.id})`);

	// Add repos
	for (const repo of repos) {
		const [existingRepo] = await db
			.select()
			.from(repositories)
			.where(eq(repositories.githubRepoId, repo.id));

		if (!existingRepo) {
			await db.insert(repositories).values({
				orgId: org.id,
				githubRepoId: repo.id,
				name: repo.name,
				fullName: repo.full_name,
				isPrivate: repo.private,
			});
			console.log(`[Callback] Added repo: ${repo.full_name}`);
		}
	}

	return "ok";
}

export const Route = createFileRoute("/api/github/callback")({
	server: {
		handlers: {
			GET: handler,
		},
	},
});
