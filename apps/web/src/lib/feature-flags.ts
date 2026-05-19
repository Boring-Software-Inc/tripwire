import { isTruthy } from "@tripwire/env/boolean"
import { env as clientEnv } from "@tripwire/env/client"

export const isProd = import.meta.env.PROD

export const isDev = import.meta.env.DEV

export const isTest = import.meta.env.MODE === "test"

export const isReactGrabEnabled =
  isDev && isTruthy(clientEnv.VITE_REACT_GRAB_ENABLED)

export const isReactScanEnabled =
  isDev && isTruthy(clientEnv.VITE_REACT_SCAN_ENABLED)
