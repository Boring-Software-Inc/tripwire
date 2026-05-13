import { eq } from "drizzle-orm";
import { db } from "#/db";
import {
	DEFAULT_RULE_CONFIG,
	type RuleConfig,
	type RuleKey,
	ruleConfigs,
} from "#/db/schema";
import { ruleConfigSchema } from "#/lib/rules/config-schema";
import { normalizeRuleConfig } from "#/lib/rules/config-draft";
import { logEvent } from "#/lib/events";
import { assertRepoOwner } from "#/integrations/trpc/init";
import type { MutationResult, ToolContext } from "./registry";

// ─── Rule-name labels for log messages ───────────────────────────

export const RULE_NAMES: Record<RuleKey, string> = {
	aiSlopDetection: "AI Slop Detection",
	languageRequirement: "Language Requirement",
	minMergedPrs: "Minimum Merged PRs",
	accountAge: "Account Age",
	maxPrsPerDay: "Max PRs Per Day",
	maxFilesChanged: "Max Files Changed",
	repoActivityMinimum: "Repo Activity Minimum",
	requireProfileReadme: "Require Profile README",
	cryptoAddressDetection: "Crypto Address Detection",
	vouchedUsersOnly: "Vouched Users Only",
	aiHoneypot: "AI Honeypot",
};

// ─── Repo ID requirement ─────────────────────────────────────────

export function requireRepoId(ctx: ToolContext): string {
	if (!ctx.repoId) {
		throw new Error("repoId is required for this tool but missing from context");
	}
	return ctx.repoId;
}

// ─── Config read/write ───────────────────────────────────────────

export async function loadRuleConfig(repoId: string): Promise<RuleConfig> {
	const [row] = await db
		.select()
		.from(ruleConfigs)
		.where(eq(ruleConfigs.repoId, repoId));
	return normalizeRuleConfig(row?.config ?? DEFAULT_RULE_CONFIG);
}

async function persistRuleConfig(repoId: string, config: RuleConfig): Promise<void> {
	const normalized = normalizeRuleConfig(config);
	const [existing] = await db
		.select({ id: ruleConfigs.id })
		.from(ruleConfigs)
		.where(eq(ruleConfigs.repoId, repoId));
	if (existing) {
		await db
			.update(ruleConfigs)
			.set({ config: normalized, updatedAt: new Date() })
			.where(eq(ruleConfigs.repoId, repoId));
	} else {
		await db.insert(ruleConfigs).values({ repoId, config: normalized });
	}
}

// ─── Mutation helper ─────────────────────────────────────────────

export interface RuleMutationOpts {
	ctx: ToolContext;
	/** Human-readable summary for the event description. */
	summary: string;
	/** Structured event metadata. `updatedBy` / `viaMcp` get merged automatically. */
	metadata?: Record<string, unknown>;
	/** Mutator: receives a draft config; mutate in place. */
	mutate: (config: RuleConfig) => void;
}

/**
 * The canonical "edit rule config" flow: assert repo ownership, load
 * current config, run a mutator on a draft, validate, persist, log.
 * Returns a MutationResult that both adapters can present.
 */
export async function applyRuleMutation(
	opts: RuleMutationOpts,
): Promise<MutationResult> {
	const repoId = requireRepoId(opts.ctx);
	await assertRepoOwner(opts.ctx.userId, repoId);

	const current = await loadRuleConfig(repoId);
	const draft = structuredClone(current) as RuleConfig;
	opts.mutate(draft);

	const parsed = ruleConfigSchema.safeParse(draft);
	if (!parsed.success) {
		const issue = parsed.error.issues[0];
		const path = issue?.path.join(".") ?? "config";
		return {
			ok: false,
			message: `Invalid rule config: ${path} — ${issue?.message ?? "validation failed"}.`,
		};
	}

	await persistRuleConfig(repoId, parsed.data);

	await logEvent({
		repoId,
		action: "rule_config_updated",
		severity: "info",
		description: opts.summary,
		metadata: {
			updatedBy: opts.ctx.userName ?? null,
			viaTool: true,
			...opts.metadata,
		},
	});

	return { ok: true, message: opts.summary };
}

// ─── Scope formatting ────────────────────────────────────────────

export function describeScope(scope: {
	pullRequests?: boolean;
	issues?: boolean;
	comments?: boolean;
}): string {
	const labels = { pullRequests: "PRs", issues: "issues", comments: "comments" } as const;
	const on: string[] = [];
	const off: string[] = [];
	for (const k of ["pullRequests", "issues", "comments"] as const) {
		if (scope[k] === true) on.push(labels[k]);
		else if (scope[k] === false) off.push(labels[k]);
	}
	const parts: string[] = [];
	if (on.length) parts.push(`on: ${on.join(", ")}`);
	if (off.length) parts.push(`off: ${off.join(", ")}`);
	return parts.join("; ") || "inherits";
}
