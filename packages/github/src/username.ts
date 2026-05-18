const GITHUB_USERNAME_RE = /^[a-z\d](?:[a-z\d]|-(?=[a-z\d])){0,38}$/i;

export function isGitHubUsername(value: string): boolean {
	return GITHUB_USERNAME_RE.test(value.trim());
}

export function normalizeGitHubUsername(value: string): string {
	const username = value.trim();
	if (!isGitHubUsername(username)) {
		throw new Error("Invalid GitHub username");
	}
	return username;
}

export function parseGitHubUsername(value: string): string | null {
	try {
		return normalizeGitHubUsername(value);
	} catch {
		return null;
	}
}

export function encodeGitHubUsername(value: string): string {
	return encodeURIComponent(normalizeGitHubUsername(value));
}
