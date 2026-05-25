import { createFileRoute } from "@tanstack/react-router"
import { useOrgRedirect } from "#/hooks/use-org-redirect"
import { privateHeaders } from "#/lib/seo"

function EventsRedirect() {
  useOrgRedirect((slug) => `/${slug}/events`)
  return null
}

export const Route = createFileRoute("/_app/events/")({
  // Pass-through that bounces to the org-scoped page. Browsers should
  // never see this URL long enough for SEO to matter; noindex anyway.
  headers: () => privateHeaders,
  component: EventsRedirect,
})
