import { eq } from "drizzle-orm"
import { db } from "@tripwire/db/client"
import { githubWebhookEvent } from "@tripwire/db"

/**
 * Webhook idempotency + audit/replay bookkeeping. Insert is idempotent on
 * `deliveryId` — GitHub retries reuse the same `X-GitHub-Delivery` UUID,
 * so the second attempt is a no-op. Returns true when a NEW row was
 * inserted (first time we've seen this delivery; caller should process).
 */
export async function recordGitHubWebhookEvent({
  deliveryId,
  event,
  signalKeys,
  receivedAt = Date.now(),
}: {
  deliveryId: string
  event: string
  signalKeys: string[]
  receivedAt?: number
}): Promise<boolean> {
  const inserted = await db
    .insert(githubWebhookEvent)
    .values({
      deliveryId,
      event,
      signalKeysJson: JSON.stringify(signalKeys),
      receivedAt,
    })
    .onConflictDoNothing({ target: githubWebhookEvent.deliveryId })
    .returning({ id: githubWebhookEvent.id })

  return inserted.length > 0
}

/** Marks a previously-recorded webhook delivery as processed (clears any prior error). */
export async function markGitHubWebhookEventProcessed(
  deliveryId: string,
  at = Date.now(),
): Promise<void> {
  await db
    .update(githubWebhookEvent)
    .set({ processedAt: at, errorMessage: null })
    .where(eq(githubWebhookEvent.deliveryId, deliveryId))
}

/** Records a processing failure so the row surfaces in logs / dashboards. */
export async function markGitHubWebhookEventFailed(
  deliveryId: string,
  errorMessage: string,
): Promise<void> {
  await db
    .update(githubWebhookEvent)
    .set({ errorMessage: errorMessage.slice(0, 2000) })
    .where(eq(githubWebhookEvent.deliveryId, deliveryId))
}
