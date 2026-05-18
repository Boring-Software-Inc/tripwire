import { describe, expect, it } from "vitest";
import { DEFAULT_RULE_CONFIG } from "@tripwire/db";
import {
	areRuleConfigsEqual,
	getRuleConfigChanges,
	normalizeRuleConfig,
	revertRuleConfigChange,
} from "./config-draft";

describe("rule config drafts", () => {
	it("does not report identical scope overrides as changed after cloning", () => {
		const base = normalizeRuleConfig({
			...DEFAULT_RULE_CONFIG,
			cryptoAddressDetection: {
				...DEFAULT_RULE_CONFIG.cryptoAddressDetection,
				scopeOverride: { issues: true, comments: false },
			},
		});
		const cloned = structuredClone(base);

		expect(areRuleConfigsEqual(base, cloned)).toBe(true);
		expect(getRuleConfigChanges(base, cloned)).toEqual([]);
	});

	it("reports and reverts scope override changes", () => {
		const base = normalizeRuleConfig(DEFAULT_RULE_CONFIG);
		const draft = normalizeRuleConfig({
			...base,
			cryptoAddressDetection: {
				...base.cryptoAddressDetection,
				scopeOverride: { issues: true },
			},
		});

		expect(getRuleConfigChanges(base, draft).map((change) => change.id)).toContain(
			"cryptoAddressDetection.scopeOverride",
		);
		expect(revertRuleConfigChange(base, draft, "cryptoAddressDetection.scopeOverride")).toEqual(base);
	});
});
