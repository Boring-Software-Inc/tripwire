import { z } from "zod";
import { DEFAULT_RULE_CONFIG } from "@tripwire/db";

const ruleActionSchema = z.enum(["block", "warn", "log", "threshold"]);

// Per-rule override on the repo-wide contentScope. If a key is set, it wins
// for this rule on that content type. If absent, the rule inherits the
// repo's contentScope[key].
const ruleScopeOverrideSchema = z.object({
	pullRequests: z.boolean().optional(),
	issues: z.boolean().optional(),
	comments: z.boolean().optional(),
}).optional();

const ruleBaseSchema = z.object({
	enabled: z.boolean(),
	action: ruleActionSchema.default("block"),
	thresholdCount: z.number().int().min(1).optional(),
	scopeOverride: ruleScopeOverrideSchema,
});

const honeypotPhraseSchema = z.object({
	kind: z.enum(["codeword", "marker", "natural", "tag"]),
	phrase: z.string().min(1),
});

const rulesMdSchema = z.object({
	autoSync: z.boolean().default(DEFAULT_RULE_CONFIG.repoFiles.rulesMd.autoSync),
	customContent: z.string().default(DEFAULT_RULE_CONFIG.repoFiles.rulesMd.customContent),
});

const prTemplateSchema = z.object({
	autoSync: z.boolean().default(DEFAULT_RULE_CONFIG.repoFiles.prTemplate.autoSync),
	honeypotEnabled: z.boolean().default(DEFAULT_RULE_CONFIG.repoFiles.prTemplate.honeypotEnabled),
	honeypotPhrases: z.array(honeypotPhraseSchema).default(DEFAULT_RULE_CONFIG.repoFiles.prTemplate.honeypotPhrases),
	customContent: z.string().default(DEFAULT_RULE_CONFIG.repoFiles.prTemplate.customContent),
});

const agentsMdSchema = z.object({
	autoSync: z.boolean().default(DEFAULT_RULE_CONFIG.repoFiles.agentsMd.autoSync),
	honeypotEnabled: z.boolean().default(DEFAULT_RULE_CONFIG.repoFiles.agentsMd.honeypotEnabled),
	honeypotPhrases: z.array(honeypotPhraseSchema).default(DEFAULT_RULE_CONFIG.repoFiles.agentsMd.honeypotPhrases),
	customContent: z.string().default(DEFAULT_RULE_CONFIG.repoFiles.agentsMd.customContent),
});

export const ruleConfigSchema = z.object({
	aiSlopDetection: ruleBaseSchema,
	languageRequirement: ruleBaseSchema.extend({
		language: z.string(),
	}),
	minMergedPrs: ruleBaseSchema.extend({ count: z.number().int().min(0) }),
	accountAge: ruleBaseSchema.extend({ days: z.number().int().min(0) }),
	maxPrsPerDay: ruleBaseSchema.extend({ limit: z.number().int().min(1) }),
	maxFilesChanged: ruleBaseSchema.extend({ limit: z.number().int().min(1) }),
	repoActivityMinimum: ruleBaseSchema.extend({ minRepos: z.number().int().min(1) }),
	requireProfileReadme: ruleBaseSchema,
	cryptoAddressDetection: ruleBaseSchema,
	vouchedUsersOnly: ruleBaseSchema.extend({
		vouchScope: z.enum(["repo", "global", "both"]).default("repo"),
	}),
	aiHoneypot: ruleBaseSchema,
	autoWhitelistGlobalVouches: z.object({
		enabled: z.boolean(),
		minVouches: z.number().int().min(1).default(1),
	}),
	contentScope: z.object({
		pullRequests: z.boolean(),
		issues: z.boolean(),
		comments: z.boolean(),
	}),
	repoFiles: z.object({
		rulesMd: rulesMdSchema.default(DEFAULT_RULE_CONFIG.repoFiles.rulesMd),
		prTemplate: prTemplateSchema.default(DEFAULT_RULE_CONFIG.repoFiles.prTemplate),
		agentsMd: agentsMdSchema.default(DEFAULT_RULE_CONFIG.repoFiles.agentsMd),
	}),
});
