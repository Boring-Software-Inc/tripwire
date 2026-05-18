import { getToolName, isToolUIPart } from "ai";
import type { UIMessage, MessagePart } from "#/types/chat";
import type { ActionResultData } from "#/types/chat";

export function getPartKey(part: MessagePart, messageId: string, index?: number): string {
	const mid = messageId || "msg";
	if (part.type === "tool-result") {
		const id = (part as { toolCallId?: string; id?: string }).toolCallId
			?? (part as { id?: string }).id;
		return `${mid}-tool-result-${id ?? index ?? 0}`;
	}
	if (isToolPart(part)) {
		return `${mid}-tool-call-${getToolCallId(part) ?? index ?? 0}`;
	}
	return `${mid}-${part.type}-${index ?? 0}`;
}

export function getTextContent(message: UIMessage): string {
	const textPart = message.parts?.find((p) => p.type === "text");
	if (textPart && textPart.type === "text") {
		return textPart.text ?? (textPart as { content?: string }).content ?? "";
	}
	return "";
}

export function formatToolName(toolName: string | undefined): string {
	if (!toolName) return "tool";
	return toolName.replace(/_/g, " ");
}

export function formatToolArgs(_toolName: string, args: Record<string, unknown>): string {
	if (args.username) return `@${args.username}`;
	if (args.eventId) return args.eventId as string;
	return "";
}

export function isToolPart(part: MessagePart): part is MessagePart & {
	state?: string;
	approval?: { id: string; approved?: boolean; reason?: string };
	input?: unknown;
	output?: unknown;
	errorText?: string;
} {
	return isToolUIPart(part as Parameters<typeof isToolUIPart>[0])
		|| part.type === "tool-call"
		|| part.type === "dynamic-tool"
		|| part.type.startsWith("tool-");
}

export function getPartToolName(part: MessagePart): string {
	if (part.type === "tool-call") return (part as { name?: string }).name ?? "tool";
	if (part.type === "dynamic-tool") return part.toolName;
	if (part.type.startsWith("tool-")) {
		return getToolName(part as Parameters<typeof getToolName>[0]);
	}
	return "tool";
}

export function getToolCallId(part: MessagePart): string | undefined {
	if ("toolCallId" in part && typeof part.toolCallId === "string") return part.toolCallId;
	if ("id" in part && typeof part.id === "string") return part.id;
	return undefined;
}

export function getToolInput(part: MessagePart): Record<string, unknown> {
	if ("input" in part && part.input && typeof part.input === "object") {
		return part.input as Record<string, unknown>;
	}
	if ("arguments" in part && typeof part.arguments === "string") {
		try {
			return JSON.parse(part.arguments) as Record<string, unknown>;
		} catch {
			return {};
		}
	}
	return {};
}

export function getToolOutput(part: MessagePart): unknown {
	if ("output" in part) return part.output;
	if ("content" in part) return part.content;
	return undefined;
}

export function parseErrorMessage(message: string): { title: string; detail: string | null } {
	const lowerMsg = message.toLowerCase();

	if (lowerMsg.includes("api key") || lowerMsg.includes("apikey") || lowerMsg.includes("unauthorized")) {
		return {
			title: "Missing API Key",
			detail: "The AI service isn't configured. Check that OPENROUTER_API_KEY is set in your environment.",
		};
	}

	if (lowerMsg.includes("repository") || lowerMsg.includes("repoid")) {
		return {
			title: "No repository selected",
			detail: "No active repository was resolved for this chat request. Open Integrations and confirm at least one repository is connected.",
		};
	}

	if (lowerMsg.includes("network") || lowerMsg.includes("fetch") || lowerMsg.includes("connection")) {
		return {
			title: "Connection error",
			detail: "Couldn't reach the server. Check your internet connection and try again.",
		};
	}

	if (lowerMsg.includes("rate limit") || lowerMsg.includes("too many")) {
		return {
			title: "Rate limited",
			detail: "Too many requests. Please wait a moment and try again.",
		};
	}

	return {
		title: "Something went wrong",
		detail: message,
	};
}

export function parseActionResult(content: string): ActionResultData | null {
	try {
		const parsed = JSON.parse(content);
		if (parsed?.root === "main" && parsed?.elements?.main?.type === "ActionResult") {
			const props = parsed.elements.main.props;
			const match = props.message?.match(/@(\w+)/);
			return {
				success: props.success,
				message: props.message,
				action: props.action,
				username: match?.[1],
			};
		}
	} catch {
		// not valid JSON
	}
	return null;
}

interface ApprovalText {
	text: string;
	yesLabel: string;
	noLabel: string;
}

const RULE_LABELS: Record<string, string> = {
	aiSlopDetection: "AI slop detection",
	languageRequirement: "language requirement",
	minMergedPrs: "minimum merged PRs",
	accountAge: "account age",
	maxPrsPerDay: "max PRs per day",
	maxFilesChanged: "max files changed",
	repoActivityMinimum: "repo activity minimum",
	requireProfileReadme: "profile README requirement",
	cryptoAddressDetection: "crypto address detection",
	vouchedUsersOnly: "vouched users only",
	aiHoneypot: "AI honeypot",
	autoWhitelistGlobalVouches: "global vouch auto-whitelist",
};

function getRuleLabel(ruleId: unknown) {
	return typeof ruleId === "string"
		? RULE_LABELS[ruleId] ?? ruleId
		: "rule";
}

function formatBoolean(value: unknown, enabledLabel: string, disabledLabel: string) {
	return value === true ? enabledLabel : disabledLabel;
}

export function getApprovalText(toolName: string, args: Record<string, unknown> = {}): ApprovalText {
	const username = typeof args.username === "string" ? args.username : undefined;
	const reason = typeof args.reason === "string" && args.reason.trim().length > 0
		? args.reason.trim()
		: undefined;
	switch (toolName) {
		case "add_to_blacklist":
			return {
				text: `Add @${username} to the blacklist? They will be blocked from all future contributions.`,
				yesLabel: "Yes, blacklist",
				noLabel: "Cancel",
			};
		case "remove_from_blacklist":
			return {
				text: `Remove @${username} from the blacklist?`,
				yesLabel: "Yes, remove",
				noLabel: "Cancel",
			};
		case "add_to_whitelist":
			return {
				text: `Add @${username} to the whitelist? They will bypass all rule checks.`,
				yesLabel: "Yes, whitelist",
				noLabel: "Cancel",
			};
		case "remove_from_whitelist":
			return {
				text: `Remove @${username} from the whitelist?`,
				yesLabel: "Yes, remove",
				noLabel: "Cancel",
			};
		case "move_to_whitelist":
			return {
				text: `Move @${username} from the blacklist to the whitelist?`,
				yesLabel: "Yes, move to whitelist",
				noLabel: "Cancel",
			};
		case "move_to_blacklist":
			return {
				text: `Move @${username} from the whitelist to the blacklist?`,
				yesLabel: "Yes, move to blacklist",
				noLabel: "Cancel",
			};
		case "reset_contributor_score":
			return {
				text: reason
					? `Reset @${username}'s contributor score? Reason: ${reason}`
					: `Reset @${username}'s contributor score? This clears accumulated Tripwire reputation totals for this repo.`,
				yesLabel: "Yes, reset score",
				noLabel: "Cancel",
			};
		case "toggle_rule":
			return {
				text: `${formatBoolean(args.enabled, "Enable", "Disable")} ${getRuleLabel(args.ruleId)}?`,
				yesLabel: "Yes, update rule",
				noLabel: "Cancel",
			};
		case "update_rule_action":
			return {
				text: `Change ${getRuleLabel(args.ruleId)} action to ${String(args.action ?? "the selected action")}?`,
				yesLabel: "Yes, change action",
				noLabel: "Cancel",
			};
		case "set_min_merged_prs":
			return {
				text: `Set minimum merged PRs to ${String(args.count ?? "the selected count")}?`,
				yesLabel: "Yes, set threshold",
				noLabel: "Cancel",
			};
		case "set_account_age":
			return {
				text: `Set account age threshold to ${String(args.days ?? "the selected days")} days?`,
				yesLabel: "Yes, set threshold",
				noLabel: "Cancel",
			};
		case "set_max_prs_per_day":
			return {
				text: `Set max PRs per day to ${String(args.limit ?? "the selected limit")}?`,
				yesLabel: "Yes, set limit",
				noLabel: "Cancel",
			};
		case "set_max_files_changed":
			return {
				text: `Set max files changed to ${String(args.limit ?? "the selected limit")}?`,
				yesLabel: "Yes, set limit",
				noLabel: "Cancel",
			};
		case "set_repo_activity_minimum":
			return {
				text: `Set repo activity minimum to ${String(args.minRepos ?? "the selected minimum")} repos?`,
				yesLabel: "Yes, set minimum",
				noLabel: "Cancel",
			};
		case "set_language_requirement":
			return {
				text: `Set required contribution language to ${String(args.language ?? "the selected language")}?`,
				yesLabel: "Yes, set language",
				noLabel: "Cancel",
			};
		case "set_content_scope":
			return {
				text: `Update watched content types? PRs: ${String(args.pullRequests)}, issues: ${String(args.issues)}, comments: ${String(args.comments)}.`,
				yesLabel: "Yes, update scope",
				noLabel: "Cancel",
			};
		case "set_rule_scope":
			return {
				text: `Limit ${getRuleLabel(args.ruleId)} to ${String(args.scope ?? "the selected scope")}?`,
				yesLabel: "Yes, set scope",
				noLabel: "Cancel",
			};
		case "clear_rule_scope":
			return {
				text: `Clear the file scope for ${getRuleLabel(args.ruleId)}?`,
				yesLabel: "Yes, clear scope",
				noLabel: "Cancel",
			};
		case "copy_rules":
			return {
				text: `Copy rules from ${String(args.sourceRepoId ?? "the selected source repo")}?`,
				yesLabel: "Yes, copy rules",
				noLabel: "Cancel",
			};
		default:
			return {
				text: `Approve ${formatToolName(toolName)} with the details below?`,
				yesLabel: "Approve",
				noLabel: "Deny",
			};
	}
}

interface BatchApprovalText {
	prefix: string;
	suffix: string;
	consequence: string | null;
	buttonLabel: string;
}

export function getBatchApprovalText(action: string): BatchApprovalText {
	switch (action) {
		case "add_to_blacklist":
			return { prefix: "Blacklist", suffix: "", consequence: "They will be blocked from all future contributions.", buttonLabel: "blacklist" };
		case "remove_from_blacklist":
			return { prefix: "Remove", suffix: "from the blacklist", consequence: null, buttonLabel: "remove" };
		case "add_to_whitelist":
			return { prefix: "Whitelist", suffix: "", consequence: "They will bypass all rule checks.", buttonLabel: "whitelist" };
		case "remove_from_whitelist":
			return { prefix: "Remove", suffix: "from the whitelist", consequence: null, buttonLabel: "remove" };
		case "move_to_whitelist":
			return { prefix: "Move", suffix: "to the whitelist", consequence: "They will be unblocked and bypass all rule checks.", buttonLabel: "move" };
		case "move_to_blacklist":
			return { prefix: "Move", suffix: "to the blacklist", consequence: "They will be blocked from all future contributions.", buttonLabel: "move" };
		case "reset_contributor_score":
			return { prefix: "Reset contributor scores for", suffix: "", consequence: "This clears accumulated Tripwire reputation totals for this repo.", buttonLabel: "reset scores" };
		default:
			return { prefix: "Approve", suffix: "", consequence: null, buttonLabel: "approve" };
	}
}
