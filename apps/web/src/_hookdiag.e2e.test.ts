import { test } from "vitest"
import { createAppJwt } from "@tripwire/github"
test.runIf(process.env.E2E_LIVE==="1")("hook config", async () => {
  const jwt = await createAppJwt()
  const r = await fetch("https://api.github.com/app/hook/config", {
    headers: { Authorization: `Bearer ${jwt}`, Accept: "application/vnd.github+json" },
  })
  console.log("hook/config →", r.status, await r.text())
  const a = await fetch("https://api.github.com/app", {
    headers: { Authorization: `Bearer ${jwt}`, Accept: "application/vnd.github+json" },
  })
  const app = await a.json()
  console.log("app.events:", app.events?.join(","))
  console.log("app.external_url:", app.external_url, "| html_url:", app.html_url)
}, 30000)
