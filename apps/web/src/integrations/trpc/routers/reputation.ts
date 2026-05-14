import { z } from "zod";
import { authedProcedure } from "../init";
import { assertRepoOwner } from "@tripwire/core";
import { resetContributorScore } from '@tripwire/core';

import type { TRPCRouterRecord } from "@trpc/server";

export const reputationRouter = {
	/**
	 * Reset a contributor's Tripwire score history for a repo.
	 *
	 * Zeros their reputation totals and stamps a scoreResetAt so future
	 * score_breakdown / lookup_user calls ignore older events. The events
	 * themselves remain in the audit feed.
	 */
	reset: authedProcedure
		.input(
			z.object({
				repoId: z.string().uuid(),
				username: z.string().min(1),
				githubUserId: z.number().int().optional(),
				reason: z.string().optional(),
			}),
		)
		.mutation(async ({ ctx, input }) => {
			await assertRepoOwner(ctx.user.id, input.repoId);
			return resetContributorScore({
				repoId: input.repoId,
				userId: ctx.user.id,
				username: input.username,
				githubUserId: input.githubUserId,
				reason: input.reason,
			});
		}),
} satisfies TRPCRouterRecord;
