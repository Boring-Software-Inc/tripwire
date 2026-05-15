import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useTRPC } from "#/integrations/trpc/react";
import { authClient } from '@tripwire/auth/client';
import { Button } from "#/components/ui/button";
import { TripwireFeatures } from "#/components/landing/tripwire-features";
import { TripwireLogo } from "#/components/icons/tripwire-logo";

export const Route = createFileRoute("/")({
	component: LandingPage,
});

function LandingPage() {
	const [email, setEmail] = useState("");
	const [status, setStatus] = useState<"idle" | "success" | "error">("idle");
	const [errorMessage, setErrorMessage] = useState("");
	const trpc = useTRPC();
	const { data: session } = authClient.useSession();

	const joinWaitlist = useMutation(
		trpc.waitlist.join.mutationOptions({
			onSuccess: () => {
				setStatus("success");
				setEmail("");
			},
			onError: (err) => {
				setStatus("error");
				setErrorMessage(err.message);
			},
		}),
	);

	function handleSubmit(e: React.FormEvent) {
		e.preventDefault();
		if (!email) return;
		setStatus("idle");
		joinWaitlist.mutate({ email });
	}

	return (
		<div className="[font-synthesis:none] flex w-full min-h-screen flex-col bg-[#191919] antialiased">
			{/* Header */}
			<div className="flex items-center justify-between p-4">
				<div className="flex items-center gap-2">
					<TripwireLogo className="w-5 h-5 text-white" />
					<span className="text-md font-medium text-tw-text-secondary font-['Geist',system-ui,sans-serif]">
						tripwire
					</span>
				</div>
				<div className="flex items-center gap-1.5">
					{session ? (
						<>
							<span className="text-[14px] text-tw-text-secondary">
								Welcome back
							</span>
							<Link
								to="/home"
								className="flex items-center h-7 px-2.5 rounded-lg text-[14px] font-medium text-black bg-white shadow-sm hover:bg-white/90 transition-colors"
							>
								dashboard
							</Link>
						</>
					) : (
						<>
							<span className="text-[14px] text-tw-text-secondary">
								Already have access?
							</span>
							<Link
								to="/login"
								className="flex items-center h-7 px-2.5 rounded-lg text-[14px] font-medium text-black bg-white shadow-sm hover:bg-white/90 transition-colors"
							>
								login
							</Link>
						</>
					)}
				</div>
			</div>

			{/* Hero Section */}
			<div className="flex w-full h-[65vh] justify-center items-center flex-col gap-10 px-4 relative">
				{/* Content */}
				<div className="flex flex-col items-center gap-4 max-w-xs w-full">
					<p className="text-white font-medium text-base text-center">
						catch slop before it catches up with you
					</p>

					{status === "success" ? (
						<div className="text-tw-success text-sm text-center">
							You're on the list!
						</div>
					) : (
						<form onSubmit={handleSubmit} className="flex justify-center items-start w-full gap-1.5">
							<input
								type="email"
								value={email}
								onChange={(e) => setEmail(e.target.value)}
								placeholder="enter email"
								className="h-7 w-full rounded-[10px] px-2 bg-white/[0.026] border border-white/[0.08] text-white text-sm placeholder:text-[#999999] focus:outline-none focus:border-white/20"
							/>
							<Button
								type="submit"
								loading={joinWaitlist.isPending}
								variant="outline"
								size="sm"
								className="bg-white text-black border-[#CDCDCD] hover:bg-white/90 shrink-0"
							>
								join waitlist
							</Button>
						</form>
					)}

					{status === "error" && (
						<div className="text-red-400 text-sm text-center">
							{errorMessage}
						</div>
					)}
				</div>
			</div>

			{/* Features Section */}
			<TripwireFeatures />
		</div>
	);
}
