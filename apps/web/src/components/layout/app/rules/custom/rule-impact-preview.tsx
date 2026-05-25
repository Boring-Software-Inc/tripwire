import { Button } from "@tripwire/ui/button"

export interface SimulationResult {
  totalContributors: number
  wouldBlock: number
  wouldPass: number
  wouldNearMiss: number
  blockPercentage: number
  contributors: Array<{
    username: string
    avatarUrl: string | null
    passed: boolean
    nearMiss: boolean
    detail: string
  }>
}

interface RuleImpactPreviewProps {
  simResult: SimulationResult | null
  isSimulating: boolean
  canSimulate: boolean
  onSimulate: () => void
}

export function RuleImpactPreview({
  simResult,
  isSimulating,
  canSimulate,
  onSimulate,
}: RuleImpactPreviewProps) {
  return (
    <div className="flex flex-col gap-2 border-t border-tw-border px-3 py-2.5">
      <div className="text-[11px] font-medium tracking-[0.08em] text-tw-text-tertiary uppercase">
        Impact Preview
      </div>
      <Button
        variant="ghost"
        type="button"
        onClick={onSimulate}
        disabled={isSimulating || !canSimulate}
        className="flex h-8 w-full items-center justify-center gap-1.5 rounded-[10px] bg-[#363639] text-[13px] font-medium text-tw-text-primary transition-colors hover:bg-[#404044] disabled:opacity-50"
      >
        {isSimulating ? "Simulating..." : "Run Simulation"}
      </Button>

      {simResult && (
        <div className="mt-1 flex flex-col gap-2">
          <div className="grid grid-cols-3 gap-1.5">
            <div className="rounded-md bg-tw-card px-2 py-1.5 text-center">
              <div className="text-[12px] font-medium text-tw-text-primary tabular-nums">
                {simResult.totalContributors}
              </div>
              <div className="text-[10px] text-tw-text-tertiary">Total</div>
            </div>
            <div className="rounded-md bg-tw-card px-2 py-1.5 text-center">
              <div className="text-[12px] font-medium text-tw-error tabular-nums">
                {simResult.wouldBlock}
              </div>
              <div className="text-[10px] text-tw-text-tertiary">Block</div>
            </div>
            <div className="rounded-md bg-tw-card px-2 py-1.5 text-center">
              <div className="text-[12px] font-medium text-tw-success tabular-nums">
                {simResult.wouldPass}
              </div>
              <div className="text-[10px] text-tw-text-tertiary">Pass</div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <div className="h-2 flex-1 overflow-hidden rounded-full bg-tw-card">
              <div
                className={`h-full rounded-full transition-all ${
                  simResult.blockPercentage > 50
                    ? "bg-tw-error"
                    : simResult.blockPercentage > 20
                      ? "bg-tw-warning"
                      : "bg-tw-success"
                }`}
                style={{ width: `${simResult.blockPercentage}%` }}
              />
            </div>
            <span className="text-[11px] text-tw-text-secondary tabular-nums">
              {simResult.blockPercentage}% blocked
            </span>
          </div>

          {simResult.blockPercentage > 50 && (
            <p className="m-0 text-[11px] text-tw-warning">
              This rule would block more than half of recent contributors.
            </p>
          )}

          {simResult.contributors.length > 0 && (
            <div className="flex max-h-[200px] flex-col gap-0.5 overflow-auto">
              {simResult.contributors.map((c) => (
                <div
                  key={c.username}
                  className="flex items-center gap-2 rounded-lg bg-tw-inner px-2 py-1.5"
                >
                  {c.avatarUrl && (
                    <img
                      src={c.avatarUrl}
                      alt=""
                      className="size-5 rounded-full"
                    />
                  )}
                  <span className="flex-1 truncate text-[12px] text-tw-text-secondary">
                    {c.username}
                  </span>
                  <span
                    className={`rounded px-1.5 py-0.5 text-[10px] font-medium ${
                      c.passed
                        ? c.nearMiss
                          ? "bg-tw-warning/10 text-tw-warning"
                          : "bg-tw-success/10 text-tw-success"
                        : "bg-tw-error/10 text-tw-error"
                    }`}
                  >
                    {c.passed ? (c.nearMiss ? "Near miss" : "Pass") : "Block"}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
