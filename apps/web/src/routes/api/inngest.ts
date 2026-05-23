import { createFileRoute } from "@tanstack/react-router"
import { serve } from "inngest/edge"
import { inngest } from "#/inngest/client"
import { processResearchRun } from "#/inngest/research"

const handler = serve({
  client: inngest,
  functions: [processResearchRun],
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
