import { createFileRoute, redirect } from "@tanstack/react-router"
import { OrgSettingsLayout } from "#/components/layout/settings/org/org-settings-layout"
import { buildSeo, formatPageTitle, PRIVATE_ROUTE_HEADERS } from "#/lib/seo"

export const Route = createFileRoute("/_app/$orgHandle/settings")({
  beforeLoad: ({ location, params }) => {
    if (location.pathname === `/${params.orgHandle}/settings`) {
      throw redirect({
        to: "/$orgHandle/settings/general",
        params: { orgHandle: params.orgHandle },
      })
    }
  },
  headers: () => PRIVATE_ROUTE_HEADERS,
  head: ({ match }) =>
    buildSeo({
      path: match.pathname,
      title: formatPageTitle("Organization settings"),
      description:
        "General, billing, and member settings for your Tripwire workspace.",
      robots: "noindex",
    }),
  component: OrgSettingsLayout,
})
