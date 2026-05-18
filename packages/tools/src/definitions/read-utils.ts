import { and, eq, sql } from "drizzle-orm";
import { createError } from "evlog";
import { z } from "zod";
import { db } from "@tripwire/db/client";
import {
	organizations,
	repositories,
} from "@tripwire/db";
import { isGitHubUsername } from '@tripwire/github';

export const githubUsernameSchema = z
	.string()
	.trim()
	.refine(isGitHubUsername, "Invalid GitHub username");

export function parseRepoFullName(input: string) {
	const parts = input.trim().split("/");
	if (parts.length !== 2 || !parts[0] || !parts[1]) {
		throw createError({
			code: "github.invalid_repo",
			status: 400,
			message: "Repo must be in owner/repo format",
			internal: { repo: input },
		});
	}
	return { owner: parts[0], repoName: parts[1], fullName: `${parts[0]}/${parts[1]}` };
}

export function sanitizeUntrustedMarkdown(value: string | null | undefined): string | null {
	if (!value) return value ?? null;
	return value
		.replace(/<[^>]*>/g, "")
		.replace(/\]\(\s*(?:javascript|data|vbscript):[^)]*\)/gi, "](#)");
}

export async function resolveOwnedRepoForInput(userId: string, repoInput: string) {
	const requested = parseRepoFullName(repoInput);
	const [row] = await db
		.select({ repo: repositories, org: organizations })
		.from(repositories)
		.innerJoin(organizations, eq(repositories.orgId, organizations.id))
		.where(
			and(
				eq(organizations.ownerId, userId),
				sql`lower(${repositories.fullName}) = ${requested.fullName.toLowerCase()}`,
			),
		)
		.limit(1);
	if (!row) {
		throw createError({
			code: "resource.not_found",
			status: 404,
			message: "Repo not found",
			internal: { repo: requested.fullName },
		});
	}
	return row.repo;
}
