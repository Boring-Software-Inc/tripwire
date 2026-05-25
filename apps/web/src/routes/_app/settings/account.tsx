import { createFileRoute } from "@tanstack/react-router"
import { AccountSettingsPage } from "#/components/layout/settings/personal/account-page"
import { buildSeo, formatPageTitle, privateHeaders } from "#/lib/seo"

export const Route = createFileRoute("/_app/settings/account")({
  component: AccountSettingsPage,
  headers: () => privateHeaders,
  head: ({ match }) =>
    buildSeo({
      path: match.pathname,
      title: formatPageTitle("Account"),
      description:
        "Manage your Tripwire profile, connected providers, active sessions, and account deletion.",
      robots: "noindex",
    }),
})
