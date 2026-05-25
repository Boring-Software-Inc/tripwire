import { createFileRoute } from "@tanstack/react-router"
import { OrgBillingSettingsPage } from "#/components/layout/settings/org/billing-page"
import { buildSeo, formatPageTitle, PRIVATE_ROUTE_HEADERS } from "#/lib/seo"

export const Route = createFileRoute("/_app/$orgHandle/settings/billing")({
  component: OrgBillingSettingsPage,
  headers: () => PRIVATE_ROUTE_HEADERS,
  head: ({ match }) =>
    buildSeo({
      path: match.pathname,
      title: formatPageTitle("Billing"),
      description:
        "Manage your Tripwire subscription, invoices, and usage limits.",
      robots: "noindex",
    }),
})
