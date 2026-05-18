import { createFileRoute } from "@tanstack/react-router";
import { authClient } from '@tripwire/auth/client';
import { useEffect } from "react";
import { Button } from "#/components/ui/button";
import { TripwireLogo } from "#/components/icons/tripwire-logo";

export const Route = createFileRoute("/login")({
	component: LoginPage,
});

function LoginPage() {
	const { data: session, isPending } = authClient.useSession();
	const callbackURL = getCallbackURL();

	useEffect(() => {
		if (!isPending && session) {
			window.location.href = callbackURL;
		}
	}, [session, isPending, callbackURL]);

	async function handleLogin() {
		await authClient.signIn.social({
			provider: "github",
			callbackURL,
		});
	}

	if (isPending) {
		return (
			<div className="flex w-full h-screen justify-center items-center bg-[#191919]">
				<div className="h-5 w-5 animate-spin rounded-full border-2 border-tw-accent border-t-transparent" />
			</div>
		);
	}

	return (
		<div className="[font-synthesis:none] flex w-full h-screen justify-center items-center gap-10 flex-col bg-[#191919] shrink-0 antialiased px-0">
			<TripwireLogo className="w-10 h-10 text-white" />
			<Button
				onClick={handleLogin}
				variant="outline"
				size="sm"
				className="bg-white text-black border-[#CDCDCD] hover:bg-white/90"
			>
				Log in
			</Button>
		</div>
	);
}

function sanitizeRedirect(value: unknown): string | undefined {
	if (typeof value !== "string") return undefined;
	if (!value.startsWith("/") || value.startsWith("//")) return undefined;
	return value;
}

function getCallbackURL(): string {
	if (typeof window === "undefined") return "/rules";
	return sanitizeRedirect(new URLSearchParams(window.location.search).get("redirect")) ?? "/rules";
}
