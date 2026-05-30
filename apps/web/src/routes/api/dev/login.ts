import { createFileRoute } from "@tanstack/react-router"
import {
  ensureDevLoginUser,
  seedDevWorkspace,
  signInDevLoginUser,
} from "#/lib/dev-seed"

async function postDevLogin({ request }: { request: Request }) {
  if (process.env.NODE_ENV !== "development") {
    return Response.json({ error: "Not found" }, { status: 404 })
  }

  try {
    await ensureDevLoginUser(request.headers)
    await seedDevWorkspace()
  } catch (error) {
    return Response.json(
      {
        error: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    )
  }

  return signInDevLoginUser(request.headers)
}

export const Route = createFileRoute("/api/dev/login")({
  server: {
    handlers: {
      POST: postDevLogin,
    },
  },
})
