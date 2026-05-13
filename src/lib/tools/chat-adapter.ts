import { toolDefinition } from "@tanstack/ai";
import { z } from "zod";
import {
	type AnyToolDefinition,
	type JsonRenderSpec,
	type ToolContext,
	type ToolDefinition,
	filterToolsForSurface,
	makeSpec,
} from "./registry";

const specSchema = z.object({
	root: z.string(),
	elements: z.record(
		z.string(),
		z.object({
			type: z.string(),
			props: z.record(z.string(), z.unknown()),
			children: z.array(z.string()).optional(),
		}),
	),
});

/**
 * Convert a registry of tool definitions into the TanStack AI tool array
 * the chat route expects (each entry has `name` + `execute` + `inputSchema`).
 *
 * The wrapper does the InferSchemaType cast once at the boundary — handlers
 * see the inferred type from their own zod schema, not `unknown`.
 */
export function createChatTools(
	ctx: ToolContext,
	tools: readonly AnyToolDefinition[],
) {
	return filterToolsForSurface(tools, "chat").map((tool) =>
		buildChatTool(tool, ctx),
	);
}

function buildChatTool<TShape extends z.ZodRawShape, TOutput>(
	tool: ToolDefinition<TShape, TOutput>,
	ctx: ToolContext,
) {
	const def = toolDefinition({
		name: tool.name,
		description: tool.description,
		inputSchema: tool.inputSchema,
		outputSchema: specSchema,
		needsApproval: tool.needsApproval,
		lazy: tool.lazy,
	});

	return def.server(async (rawArgs) => {
		// TanStack-AI infers args as `unknown` because zod 4's standard-schema
		// interface isn't recognized by InferSchemaType. We've validated the
		// schema by registering it; cast through the tool's own inferred type.
		const args = rawArgs as z.infer<z.ZodObject<TShape>>;

		try {
			const output = await tool.handler(args, ctx);
			if (tool.chatRender) return tool.chatRender(output, args);
			return defaultChatRender(output, tool.name);
		} catch (error) {
			const message = error instanceof Error ? error.message : String(error);
			return makeSpec("ActionResult", {
				success: false,
				message,
				action: tool.name,
			});
		}
	});
}

/**
 * Fallback presenter for tools without an explicit chatRender. Produces an
 * ActionResult card. Reads `ok` and `message` from the output if present.
 */
function defaultChatRender(output: unknown, action: string): JsonRenderSpec {
	if (output && typeof output === "object") {
		const obj = output as Record<string, unknown>;
		const ok = typeof obj.ok === "boolean" ? obj.ok : true;
		const message = typeof obj.message === "string" ? obj.message : "Done.";
		return makeSpec("ActionResult", { success: ok, message, action });
	}
	return makeSpec("ActionResult", {
		success: true,
		message: typeof output === "string" ? output : "Done.",
		action,
	});
}
