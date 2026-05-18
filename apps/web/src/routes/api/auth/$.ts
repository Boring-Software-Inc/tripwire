import { createFileRoute } from '@tanstack/react-router'
import { auth } from '@tripwire/auth'
import { oauthAccessToken } from '@tripwire/db'
import { db } from '@tripwire/db/client'
import { eq } from 'drizzle-orm'

async function handleAuthRequest(request: Request) {
  const pathname = new URL(request.url).pathname
  if (request.method === 'GET' && pathname.endsWith('/mcp/get-session')) {
    return handleMcpGetSession(request)
  }
  return auth.handler(request)
}

async function handleMcpGetSession(request: Request) {
  const accessToken = request.headers.get('Authorization')?.replace(/^Bearer\s+/i, '')
  if (!accessToken) {
    return jsonNullSession()
  }

  const [token] = await db
    .select()
    .from(oauthAccessToken)
    .where(eq(oauthAccessToken.accessToken, accessToken))
    .limit(1)

  if (!token || token.accessTokenExpiresAt <= new Date()) {
    return jsonNullSession()
  }

  const { refreshToken: _refreshToken, ...session } = token
  return Response.json(session, {
    headers: {
      'Cache-Control': 'no-store',
      Pragma: 'no-cache',
    },
  })
}

function jsonNullSession() {
  return Response.json(null, {
    headers: {
      'WWW-Authenticate': 'Bearer',
      'Cache-Control': 'no-store',
      Pragma: 'no-cache',
    },
  })
}

export const Route = createFileRoute('/api/auth/$')({
  server: {
    handlers: {
      GET: ({ request }) => handleAuthRequest(request),
      POST: ({ request }) => handleAuthRequest(request),
    },
  },
})
