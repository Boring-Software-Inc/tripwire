import { cn } from "../utils"

export function InsightsIcon({ className }: { className?: string }) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={cn("size-[18px] shrink-0", className)}
    >
      <path
        d="M3 10.989L3.969 13.304C4.328 14.159 5.548 14.112 5.84 13.232L7.021 9.67C7.328 8.744 8.634 8.756 8.924 9.688L11.909 19.294C12.213 20.271 13.604 20.221 13.837 19.225L17.219 4.775C17.448 3.798 18.803 3.724 19.135 4.671L21 9.983"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}
