export interface DashboardConfig {
	serverUrl: URL;
	authPassword: string;
	adminKey: string;
	host: string;
	port: number;
	secureCookies: boolean;
	sessionTtlMinutes: number;
	upstreamTimeoutMs: number;
}

function required(
	environment: Record<string, string | undefined>,
	name: string,
): string {
	const value = environment[name]?.trim();
	if (!value) throw new Error(`${name} must be configured.`);
	return value;
}

function booleanValue(
	environment: Record<string, string | undefined>,
	name: string,
	fallback: boolean,
): boolean {
	const raw = environment[name];
	if (raw === undefined || raw === "") return fallback;
	if (raw === "true") return true;
	if (raw === "false") return false;
	throw new Error(`${name} must be either true or false.`);
}

function integerValue(
	environment: Record<string, string | undefined>,
	name: string,
	fallback: number,
	minimum: number,
	maximum: number,
): number {
	const raw = environment[name];
	if (raw === undefined || raw === "") return fallback;
	const value = Number(raw);
	if (!Number.isInteger(value) || value < minimum || value > maximum) {
		throw new Error(
			`${name} must be an integer between ${minimum} and ${maximum}.`,
		);
	}
	return value;
}

function isLoopback(hostname: string): boolean {
	return (
		hostname === "localhost" ||
		hostname === "127.0.0.1" ||
		hostname === "[::1]" ||
		hostname === "::1"
	);
}

function serverUrl(environment: Record<string, string | undefined>): URL {
	const raw = required(environment, "KEYZORI_SERVER_URL");
	let url: URL;
	try {
		url = new URL(raw);
	} catch {
		throw new Error("KEYZORI_SERVER_URL must be a valid absolute URL.");
	}
	if (url.username || url.password || url.search || url.hash) {
		throw new Error(
			"KEYZORI_SERVER_URL cannot contain credentials, a query, or a fragment.",
		);
	}
	if (url.pathname !== "/" && url.pathname !== "") {
		throw new Error("KEYZORI_SERVER_URL must point to the server origin.");
	}
	if (
		url.protocol !== "https:" &&
		!(url.protocol === "http:" && isLoopback(url.hostname)) &&
		!booleanValue(environment, "KEYZORI_ALLOW_INSECURE_SERVER", false)
	) {
		throw new Error(
			"KEYZORI_SERVER_URL must use HTTPS outside loopback. Set KEYZORI_ALLOW_INSECURE_SERVER=true only for a trusted private network.",
		);
	}
	url.pathname = "/";
	return url;
}

function assertSecret(name: string, value: string, minimum: number): void {
	if (
		value.length < minimum ||
		/^(replace|change|your[_-]?secure|example|development|password)/i.test(
			value,
		)
	) {
		throw new Error(
			`${name} must be a non-placeholder secret of at least ${minimum} characters.`,
		);
	}
}

export function loadDashboardConfig(
	environment: Record<string, string | undefined> = Bun.env,
): DashboardConfig {
	const authPassword = required(environment, "KEYZORI_AUTH_PASS");
	const adminKey = required(environment, "KEYZORI_ADMIN_KEY");
	assertSecret("KEYZORI_AUTH_PASS", authPassword, 16);
	assertSecret("KEYZORI_ADMIN_KEY", adminKey, 32);
	if (authPassword === adminKey) {
		throw new Error(
			"KEYZORI_AUTH_PASS and KEYZORI_ADMIN_KEY must be different secrets.",
		);
	}

	return {
		serverUrl: serverUrl(environment),
		authPassword,
		adminKey,
		host: environment.HOST?.trim() || "0.0.0.0",
		port: integerValue(environment, "PORT", 3100, 1, 65_535),
		secureCookies: booleanValue(environment, "KEYZORI_SECURE_COOKIES", true),
		sessionTtlMinutes: integerValue(
			environment,
			"KEYZORI_SESSION_TTL_MINUTES",
			480,
			5,
			1_440,
		),
		upstreamTimeoutMs: integerValue(
			environment,
			"KEYZORI_UPSTREAM_TIMEOUT_MS",
			10_000,
			1_000,
			60_000,
		),
	};
}
