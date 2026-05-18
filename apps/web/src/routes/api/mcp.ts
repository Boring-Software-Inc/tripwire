import { createFileRoute } from "@tanstack/react-router";
import { createMcpHandler } from "mcp-handler";
import { withMcpAuth } from "better-auth/plugins";
import { auth } from "@tripwire/auth";
import { registerMcpTools, SERVER_INSTRUCTIONS } from "@tripwire/mcp";
import { tripwireTools } from "@tripwire/tools";

const unauthorized = () => Response.json({
	jsonrpc: "2.0",
	error: {
		code: -32000,
		message: "Unauthorized: Authentication required",
	},
	id: null,
}, { status: 401, headers: { "WWW-Authenticate": "Bearer" } });

const handler = withMcpAuth(auth, (req, session) => {
	const expiresAt = new Date(session.accessTokenExpiresAt);
	if (Number.isNaN(expiresAt.getTime()) || expiresAt.getTime() <= Date.now()) {
		return unauthorized();
	}

	return createMcpHandler(
		(server) => {
			registerMcpTools(server, session.userId, tripwireTools);
		},
		{
			capabilities: {
				tools: {},
			},
			instructions: SERVER_INSTRUCTIONS,
		},
		{
			basePath: "/api",
			verboseLogs: false,
			maxDuration: 60,
		},
	)(req);
});

export const Route = createFileRoute("/api/mcp")({
	server: {
		handlers: {
			GET: ({ request }) => handler(request),
			POST: ({ request }) => handler(request),
			DELETE: ({ request }) => handler(request),
		},
	},
});
