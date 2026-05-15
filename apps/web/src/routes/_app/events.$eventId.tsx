import { createFileRoute } from "@tanstack/react-router";
import { useEffect } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useWorkspace } from "#/lib/workspace-context";

export const Route = createFileRoute("/_app/events/$eventId")({
	component: Redirect,
});

function Redirect() {
	const { eventId } = Route.useParams();
	const navigate = useNavigate();
	const { org, orgs, isLoading } = useWorkspace();
	useEffect(() => {
		if (isLoading) return;
		const target = org || orgs[0]; if (target) navigate({ to: `/${target.slug}/events/${eventId}`, replace: true });
	}, [isLoading, org, orgs, eventId, navigate]);
	return null;
}
