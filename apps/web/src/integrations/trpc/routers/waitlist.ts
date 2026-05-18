import { z } from "zod";
import { createHash } from "node:crypto";
import { createTRPCRouter, publicProcedure } from "../init";
import { db } from "@tripwire/db/client";
import { waitlist } from "@tripwire/db";
import { checkRateLimit } from "@tripwire/ratelimit";

export const waitlistRouter = createTRPCRouter({
	join: publicProcedure
		.input(z.object({ email: z.string().trim().email() }))
		.mutation(async ({ input, ctx }) => {
			const email = input.email.toLowerCase();
			const emailIdentifier = createHash("sha256")
				.update(email)
				.digest("hex")
				.slice(0, 32);
			const ipIdentifier = createHash("sha256")
				.update(getClientIp(ctx.headers))
				.digest("hex")
				.slice(0, 32);
			await Promise.all([
				checkRateLimit("waitlistGlobal", "join"),
				checkRateLimit("waitlist", `email:${emailIdentifier}`),
				checkRateLimit("waitlist", `ip:${ipIdentifier}`),
			]);

			try {
				await db.insert(waitlist).values({ email });
				return { success: true };
				} catch (err) {
					// Return the same success envelope for duplicate emails so the
					// endpoint cannot be used as a waitlist membership oracle.
					if ((err as { code?: string } | null)?.code === "23505") {
						return { success: true };
					}
				throw err;
			}
		}),
});

function getClientIp(headers: Headers): string {
	const cfIp = headers.get("cf-connecting-ip")?.trim();
	if (cfIp) return cfIp;
	const realIp = headers.get("x-real-ip")?.trim();
	if (realIp) return realIp;
	const forwardedFor = headers.get("x-forwarded-for");
	const firstForwarded = forwardedFor?.split(",")[0]?.trim();
	return (
		firstForwarded ||
		"unknown"
	);
}
