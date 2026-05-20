import type React from "react"
import { cn } from "./utils"

export function Skeleton({
  className,
  ...props
}: React.ComponentProps<"div">): React.ReactElement {
  return (
    <div
      className={cn("rounded-sm bg-white/5", className)}
      data-slot="skeleton"
      {...props}
    />
  )
}
