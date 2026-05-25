import { createFileRoute, redirect } from "@tanstack/react-router"
import { PersonalSettingsLayout } from "#/components/layout/settings/personal/personal-settings-layout"
import { PRIVATE_ROUTE_HEADERS } from "#/lib/seo"

export const Route = createFileRoute("/_app/settings")({
  beforeLoad: ({ location }) => {
    if (location.pathname === "/settings") {
      throw redirect({ to: "/settings/account" })
    }
  },
  headers: () => PRIVATE_ROUTE_HEADERS,
  component: PersonalSettingsLayout,
})
