import { useWorkspace } from "#/lib/workspace-context";
import {
	Menu,
	MenuTrigger,
	MenuPopup,
	MenuItem,
	MenuSeparator,
} from "#/components/ui/menu";

function ChevronDown() {
	return (
		<svg width="10" height="10" viewBox="0 0 10 10" fill="none" className="text-tw-text-tertiary">
			<path d="M2.5 4L5 6.5L7.5 4" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
		</svg>
	);
}

export function OrgSwitcher() {
	const { org, orgs, setOrg } = useWorkspace();

	if (orgs.length === 0) return null;

	return (
		<Menu>
			<MenuTrigger className="flex items-center gap-1.5 h-8 px-2 rounded-lg text-tw-text-muted hover:text-tw-text-primary hover:bg-tw-hover transition-colors cursor-pointer">
				{org?.logo ? (
					<img src={org.logo} alt="" className="w-4 h-4 rounded-full" />
				) : (
					<div className="w-4 h-4 rounded-full bg-tw-inner flex items-center justify-center text-[9px] font-semibold text-tw-text-tertiary">
						{org?.name?.[0]?.toUpperCase() ?? "?"}
					</div>
				)}
				<span className="text-[13px] font-medium leading-none max-w-[120px] truncate">
					{org?.name ?? "Select org"}
				</span>
				<ChevronDown />
			</MenuTrigger>
			<MenuPopup align="end">
				{orgs.map((o) => (
					<MenuItem
						key={o.id}
						onClick={() => setOrg(o)}
						className="flex items-center justify-between"
					>
						<span className="flex items-center gap-2">
							{o.logo ? (
								<img src={o.logo} alt="" className="w-4 h-4 rounded-full" />
							) : (
								<div className="w-4 h-4 rounded-full bg-tw-inner flex items-center justify-center text-[9px] font-semibold text-tw-text-tertiary">
									{o.name[0]?.toUpperCase()}
								</div>
							)}
							{o.name}
						</span>
						{org?.id === o.id && (
							<svg width="12" height="12" viewBox="0 0 12 12" fill="none" className="text-tw-accent shrink-0">
								<path d="M2.5 6L5 8.5L9.5 3.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
							</svg>
						)}
					</MenuItem>
				))}
			</MenuPopup>
		</Menu>
	);
}

export function RepoSwitcher() {
	const { repo, repos, setRepo } = useWorkspace();

	if (repos.length === 0) {
		return (
			<span className="text-[13px] text-tw-text-tertiary px-1">
				No repos
			</span>
		);
	}

	return (
		<Menu>
			<MenuTrigger className="flex items-center gap-1.5 h-8 px-2 rounded-lg text-tw-text-muted hover:text-tw-text-primary hover:bg-tw-hover transition-colors cursor-pointer">
				<span className="text-[13px] font-medium leading-none font-mono max-w-[160px] truncate">
					{repo?.name ?? "Select repo"}
				</span>
				<ChevronDown />
			</MenuTrigger>
			<MenuPopup align="end">
				{repos.map((r) => (
					<MenuItem
						key={r.id}
						onClick={() => setRepo(r)}
						className="flex items-center justify-between"
					>
						<span className="font-mono text-[12px]">{r.fullName}</span>
						{repo?.id === r.id && (
							<svg width="12" height="12" viewBox="0 0 12 12" fill="none" className="text-tw-accent shrink-0">
								<path d="M2.5 6L5 8.5L9.5 3.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
							</svg>
						)}
					</MenuItem>
				))}
			</MenuPopup>
		</Menu>
	);
}

/** Combined org / repo display with separator */
export function OrgRepoSwitcher() {
	return (
		<div className="flex items-center gap-0.5">
			<OrgSwitcher />
			<span className="text-[13px] text-tw-text-tertiary select-none">/</span>
			<RepoSwitcher />
		</div>
	);
}
