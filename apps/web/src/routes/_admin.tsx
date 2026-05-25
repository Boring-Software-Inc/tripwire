import { createFileRoute } from "@tanstack/react-router"
import { AdminShell } from "#/components/layout/admin/admin-shell"
import { PRIVATE_ROUTE_HEADERS } from "#/lib/seo"

export const Route = createFileRoute("/_admin")({
  component: AdminShell,
  headers: () => PRIVATE_ROUTE_HEADERS,
})
