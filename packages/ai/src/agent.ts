import { Agent } from "@ai-sdk-tools/agents"
import type { LanguageModel, LanguageModelUsage, ToolSet, UIMessage } from "ai"
import { memoryProvider } from "./memory"
import { trackCreditUsage, logCreditUsageError } from "./credit-middleware"

interface TripwireAgentContext extends Record<string, unknown> {
  chatId: string
  userId: string
}

interface CreateTripwireAgentOptions {
  model: LanguageModel
  tools: ToolSet
  systemPrompt: string
  userId: string
  userName: string
  userEmail?: string
  conversationId: string
  repoId: string
  modelId: string
}

export function createTripwireAgent(opts: CreateTripwireAgentOptions) {
  const agent = new Agent<TripwireAgentContext>({
    name: "tripwire",
    model: opts.model,
    instructions: opts.systemPrompt,
    tools: opts.tools,
    maxTurns: 10,
    memory: {
      provider: memoryProvider,
      workingMemory: { enabled: true, scope: "user" },
      history: { enabled: true, limit: 50 },
      chats: { enabled: true, generateTitle: true },
    },
  })

  let lastUsage: LanguageModelUsage | undefined

  return {
    toUIMessageStream(message: UIMessage) {
      return agent.toUIMessageStream({
        message,
        context: {
          chatId: opts.conversationId,
          userId: opts.userId,
        },
        onFinish: async () => {
          if (!lastUsage) return
          await trackCreditUsage({
            customerId: opts.userId,
            modelId: opts.modelId,
            userName: opts.userName,
            userEmail: opts.userEmail,
            repoId: opts.repoId,
            usage: lastUsage,
          }).catch((err: unknown) => {
            logCreditUsageError({
              customerId: opts.userId,
              modelId: opts.modelId,
              userName: opts.userName,
              userEmail: opts.userEmail,
              repoId: opts.repoId,
              error: err,
            })
          })
        },
        onError: (error) => {
          logCreditUsageError({
            customerId: opts.userId,
            modelId: opts.modelId,
            userName: opts.userName,
            userEmail: opts.userEmail,
            repoId: opts.repoId,
            error,
          })
          const err = error as Error
          return err?.message ?? "An error occurred"
        },
        messageMetadata: ({ part }) => {
          const p = part as Record<string, unknown>
          if (p.type === "finish" && p.totalUsage) {
            lastUsage = p.totalUsage as LanguageModelUsage
            return {
              usage: p.totalUsage,
              modelId: opts.modelId,
            }
          }
          return undefined
        },
      })
    },
  }
}
