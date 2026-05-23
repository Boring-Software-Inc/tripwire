import { Inngest } from "inngest"
import { env } from "@tripwire/env/server"

const isDev = env.NODE_ENV !== "production"

export const inngest = new Inngest({
  id: "tripwire",
  isDev,
  eventKey: env.INNGEST_EVENT_KEY,
  signingKey: env.INNGEST_SIGNING_KEY,
  env: env.INNGEST_ENV,
})

export type ResearchRunRequestedEvent = {
  name: "research/run.requested"
  data: {
    runId: string
  }
}

export type Events = {
  "research/run.requested": ResearchRunRequestedEvent
}
