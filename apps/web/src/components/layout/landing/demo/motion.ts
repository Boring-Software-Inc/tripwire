/** Shared entrance choreography — pages stagger in like real loads. */
export const listStagger = {
  animate: { transition: { staggerChildren: 0.07, delayChildren: 0.08 } },
}

export const rowIn = {
  initial: { opacity: 0, y: 10 },
  animate: {
    opacity: 1,
    y: 0,
    transition: { type: "spring", visualDuration: 0.4, bounce: 0.1 },
  },
} as const
