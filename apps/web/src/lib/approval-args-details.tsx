export function ApprovalArgsDetails({ args }: { args: Record<string, unknown> }) {
	const entries = Object.entries(args);
	if (entries.length === 0) return null;

	return (
		<div className="rounded-lg bg-[#FAFAFA08] border border-[#FAFAFA0F] p-2 flex flex-col gap-1">
			{entries.map(([key, value]) => (
				<div key={key} className="grid grid-cols-[92px_minmax(0,1fr)] gap-2 text-[11px] leading-4">
					<span className="text-tw-text-muted">{key}</span>
					<span className="font-mono text-tw-text-secondary break-words">
						{formatApprovalArg(value)}
					</span>
				</div>
			))}
		</div>
	);
}

export function formatApprovalArg(value: unknown): string {
	if (typeof value === "string") return value;
	if (typeof value === "number" || typeof value === "boolean") return String(value);
	if (value === null) return "null";
	if (value === undefined) return "undefined";
	return JSON.stringify(value);
}
