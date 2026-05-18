import type { ReactNode } from "react";
import { renderInlineText } from "#/components/chat/chips";

export function getBriefActionText(action: string, username?: string, reason?: string): ReactNode {
	const user = username ? <>{renderInlineText(`@${username}`)}</> : "user";
	switch (action) {
		case "add_to_blacklist":
			return <>Blacklist {user}</>;
		case "remove_from_blacklist":
			return <>Remove {user} from blacklist</>;
		case "add_to_whitelist":
			return <>Whitelist {user}</>;
		case "remove_from_whitelist":
			return <>Remove {user} from whitelist</>;
		case "move_to_whitelist":
			return <>Move {user} to whitelist</>;
		case "move_to_blacklist":
			return <>Move {user} to blacklist</>;
		case "reset_contributor_score":
			return <>Reset score for {user}{reason ? <>: {reason}</> : null}</>;
		default:
			return <>{action.replace(/_/g, " ")} {user}</>;
	}
}
