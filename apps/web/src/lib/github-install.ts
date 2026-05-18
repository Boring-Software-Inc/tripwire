import { and, eq } from "drizzle-orm";
import { db } from "@tripwire/db/client";
import { organizations, repositories, account, member } from "@tripwire/db";
import { createAppJwt, getInstallationToken } from "@tripwire/github";

interface InstallationMeta {
	accountId: number;
	accountType: string;
	accountLogin: string;
	avatarUrl?: string;
}

interface InstallationRepo {
	id: number;
	name: string;
	full_name: string;
	private: boolean;
}

async function fetchInstallationMeta(
	installationId: number,
): Promise<InstallationMeta | null> {
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
		console.error("[Callback] Failed to fetch installation metadata:", res.status);
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
		avatarUrl: (data.account as { avatar_url?: string }).avatar_url,
	};
}

async function hasOrgAdminAccess(
	accessToken: string | null,
	accessTokenExpiresAt: Date | null,
	orgLogin: string,
): Promise<boolean> {
	if (!accessToken) return false;
	if (accessTokenExpiresAt && accessTokenExpiresAt.getTime() <= Date.now()) {
		return false;
	}

	const res = await fetch(
		`https://api.github.com/user/memberships/orgs/${encodeURIComponent(orgLogin)}`,
		{
			headers: {
				Authorization: `Bearer ${accessToken}`,
				Accept: "application/vnd.github+json",
				"X-GitHub-Api-Version": "2022-11-28",
			},
		},
	);
	if (!res.ok) {
		console.warn("[Callback] Failed to verify GitHub org membership", {
			orgLogin,
			status: res.status,
		});
		return false;
	}

	const membership = (await res.json()) as { role?: string; state?: string };
	return membership.role === "admin" && membership.state === "active";
}

async function fetchInstallationRepos(
	installationId: number,
): Promise<InstallationRepo[] | null> {
	const token = await getInstallationToken(installationId);
	const repos: InstallationRepo[] = [];
	const perPage = 100;
	let page = 1;
	let hasNextPage = true;

	while (hasNextPage) {
		const reposRes = await fetch(
			`https://api.github.com/installation/repositories?per_page=${perPage}&page=${page}`,
			{
				headers: {
					Authorization: `token ${token}`,
					Accept: "application/vnd.github.v3+json",
				},
			},
		);

		if (!reposRes.ok) {
			console.error("[Callback] Failed to fetch repos:", reposRes.status);
			return null;
		}

		const { repositories: pageRepos } = (await reposRes.json()) as {
			repositories?: InstallationRepo[];
		};
		const currentRepos = pageRepos ?? [];
		repos.push(...currentRepos);

		const linkHeader = reposRes.headers.get("Link");
		const hasLinkNext = linkHeader?.includes('rel="next"') ?? false;
		hasNextPage = linkHeader ? hasLinkNext : currentRepos.length === perPage;
		page += 1;
	}

	return repos;
}

async function upsertInstallationRepo(
	orgId: string,
	repo: InstallationRepo,
): Promise<void> {
	const [existingRepo] = await db
		.select({ id: repositories.id })
		.from(repositories)
		.where(eq(repositories.githubRepoId, repo.id));

	if (existingRepo) {
		await db
			.update(repositories)
			.set({
				orgId,
				name: repo.name,
				fullName: repo.full_name,
				isPrivate: repo.private,
				updatedAt: new Date(),
			})
			.where(eq(repositories.id, existingRepo.id));
		return;
	}

	await db.insert(repositories).values({
		orgId,
		githubRepoId: repo.id,
		name: repo.name,
		fullName: repo.full_name,
		isPrivate: repo.private,
	});
}

/**
 * Ensure the org + repos exist for this installation, and verify that the
 * GitHub account that owns the installation is linked to the session user
 * (via better-auth `account` row).
 *
 * Returns "installer_mismatch" if the GH installer isn't the session user's
 * linked GH identity — any rows inserted by this call are rolled back.
 */
export async function ensureInstallation(
	installationId: number,
	userId: string,
): Promise<"ok" | "installer_mismatch"> {
	const [existing] = await db
		.select()
		.from(organizations)
		.where(eq(organizations.githubInstallationId, installationId));

	if (existing && existing.ownerId !== userId) return "installer_mismatch";

	const meta = await fetchInstallationMeta(installationId);
	if (!meta) return "installer_mismatch";

	const [ghAccountRow] = await db
		.select({
			accountId: account.accountId,
			accessToken: account.accessToken,
			accessTokenExpiresAt: account.accessTokenExpiresAt,
		})
		.from(account)
		.where(
			and(eq(account.userId, userId), eq(account.providerId, "github")),
		);

	if (!ghAccountRow) {
		console.warn("[Callback] Session user has no linked GitHub account");
		return "installer_mismatch";
	}

	if (meta.accountType === "User") {
		if (String(meta.accountId) !== String(ghAccountRow.accountId)) {
			console.warn(
				"[Callback] Installer GitHub user id does not match session user",
				{ installerAccountId: meta.accountId, linked: ghAccountRow.accountId },
			);
			return "installer_mismatch";
		}
	}
	if (
		meta.accountType === "Organization" &&
		!(await hasOrgAdminAccess(
			ghAccountRow.accessToken,
			ghAccountRow.accessTokenExpiresAt,
			meta.accountLogin,
		))
	) {
		console.warn("[Callback] Session user is not an admin of GitHub org", {
			orgLogin: meta.accountLogin,
		});
		return "installer_mismatch";
	}

	const [existingAccountOrg] = await db
		.select()
		.from(organizations)
		.where(eq(organizations.githubAccountId, meta.accountId));

	if (existingAccountOrg && existingAccountOrg.ownerId !== userId) {
		return "installer_mismatch";
	}
	const existingOrg = existingAccountOrg ?? existing ?? null;

	const [ownerMembership] = await db
		.select({ organizationId: member.organizationId })
		.from(member)
		.where(and(eq(member.userId, userId), eq(member.role, "owner")))
		.limit(1);

	const [org] = existingOrg
		? await db
			.update(organizations)
			.set({
				githubInstallationId: installationId,
				githubAccountId: meta.accountId,
				githubAccountLogin: meta.accountLogin,
				githubAccountType: meta.accountType,
				avatarUrl: meta.avatarUrl,
				betterAuthOrgId: ownerMembership?.organizationId ?? existingOrg.betterAuthOrgId,
				updatedAt: new Date(),
			})
			.where(eq(organizations.id, existingOrg.id))
			.returning()
		: await db
			.insert(organizations)
			.values({
				githubInstallationId: installationId,
				githubAccountId: meta.accountId,
				githubAccountLogin: meta.accountLogin,
				githubAccountType: meta.accountType,
				avatarUrl: meta.avatarUrl,
				ownerId: userId,
				betterAuthOrgId: ownerMembership?.organizationId ?? null,
			})
			.returning();

	console.log(`[Callback] Ensured org "${meta.accountLogin}" (ID: ${org.id})`);

	const repos = await fetchInstallationRepos(installationId);
	if (!repos) return "ok";
	for (const repo of repos) {
		await upsertInstallationRepo(org.id, repo);
	}

	return "ok";
}
