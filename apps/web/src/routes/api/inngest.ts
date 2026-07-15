import { createFileRoute } from "@tanstack/react-router"
import { serve } from "inngest/edge"
import { inngest } from "#/inngest/client"
import { processResearchRun } from "#/inngest/research"
import { syncRepoHistory } from "#/inngest/visibility"
import { scoreUser } from "#/inngest/score-user"
import { sendAccessApprovedEmail } from "#/inngest/access-approved"

const handler = serve({
  client: inngest,
  functions: [
    processResearchRun,
    syncRepoHistory,
    scoreUser,
    sendAccessApprovedEmail,
  ],
})

export const Route = createFileRoute("/api/inngest")({
  server: {
    handlers: {
      GET: ({ request }: { request: Request }) => handler(request),
      POST: ({ request }: { request: Request }) => handler(request),
      PUT: ({ request }: { request: Request }) => handler(request),
    },
  },
})
