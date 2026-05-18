import { describe, expect, it } from "vitest";
import { DEFAULT_RULE_CONFIG } from "@tripwire/db";
import { ruleConfigSchema } from "./config-schema";

describe("rule config schema", () => {
	it("backfills newly added repo file sections when importing older configs", () => {
		const legacyConfig = structuredClone(DEFAULT_RULE_CONFIG);
		// Simulate a config exported before AGENTS.md support existed.
		delete (legacyConfig.repoFiles as Partial<typeof legacyConfig.repoFiles>).agentsMd;

		const parsed = ruleConfigSchema.parse(legacyConfig);

		expect(parsed.repoFiles.agentsMd).toEqual(DEFAULT_RULE_CONFIG.repoFiles.agentsMd);
	});

	it("backfills missing repo file content fields", () => {
		const legacyConfig = structuredClone(DEFAULT_RULE_CONFIG);
		delete (legacyConfig.repoFiles.rulesMd as Partial<typeof legacyConfig.repoFiles.rulesMd>).customContent;
		delete (legacyConfig.repoFiles.prTemplate as Partial<typeof legacyConfig.repoFiles.prTemplate>).customContent;

		const parsed = ruleConfigSchema.parse(legacyConfig);

		expect(parsed.repoFiles.rulesMd.customContent).toBe("");
		expect(parsed.repoFiles.prTemplate.customContent).toBe("");
	});
});
