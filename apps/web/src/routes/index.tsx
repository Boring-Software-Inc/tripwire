import { createFileRoute } from "@tanstack/react-router"
import { LandingPage } from "#/components/layout/landing/landing-page"
import { buildSeo } from "#/lib/seo"

export const Route = createFileRoute("/")({
  component: LandingPage,
  head: ({ match }) =>
    buildSeo({
      path: match.pathname,
      title: "Tripwire — catch slop before it catches up with you",
      description:
        "Open source GitHub moderation for spam PRs, bot accounts, and AI-generated contributions. Rules that run on every webhook so maintainers don't have to.",
      type: "website",
    }),
})
