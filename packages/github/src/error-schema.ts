import { z } from "zod"

/**
 * Permissive zod schema for the shapes thrown errors take across the GitHub
 * client (Octokit-style wrappers, plain `Error`s, fetch failures). Every field
 * is optional — `safeParse` never rejects a real error, it just extracts the
 * fields we classify on. Replaces the hand-rolled `isRecord` digging in
 * `auth-errors.ts` and `cache.ts`.
 */
export const githubErrorSchema = z.object({
  status: z.number().optional(),
  message: z.string().optional(),
  response: z
    .object({
      data: z.unknown().optional(),
      headers: z.record(z.string(), z.unknown()).optional(),
    })
    .optional(),
})

/** The JSON body GitHub returns on API errors — we read its `message`. */
export const githubApiBodySchema = z.object({
  message: z.string().optional(),
})
