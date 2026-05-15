import { createFileRoute } from "@tanstack/react-router";
import { useEffect } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useWorkspace } from "#/lib/workspace-context";

export const Route = createFileRoute("/_app/events/")({
	component: Redirect,
});

function Redirect() {
	const navigate = useNavigate();
	const { org, orgs, isLoading } = useWorkspace();
	useEffect(() => {
		if (isLoading) return;
		const target = org || orgs[0]; if (target) navigate({ to: `/${target.slug}/events`, replace: true });
	}, [isLoading, org, orgs, navigate]);
	return null;
}
