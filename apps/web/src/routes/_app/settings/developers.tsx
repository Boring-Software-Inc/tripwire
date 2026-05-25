import { createFileRoute } from "@tanstack/react-router"
import { DevelopersSettingsPage } from "#/components/layout/settings/personal/developers-page"
import { buildSeo, formatPageTitle, privateHeaders } from "#/lib/seo"

export const Route = createFileRoute("/_app/settings/developers")({
  component: DevelopersSettingsPage,
  headers: () => privateHeaders,
  head: ({ match }) =>
    buildSeo({
      path: match.pathname,
      title: formatPageTitle("Developers"),
      description:
        "API keys, webhook secrets, and integration tokens for your Tripwire account.",
      robots: "noindex",
    }),
})
