import { Elysia, t } from "elysia";
import { isSameOriginMutation, SessionManager } from "./auth";
import { type DashboardConfig, loadDashboardConfig } from "./config";
import { KeyzoriApi } from "./upstream";

const publicAsset = (name: string) =>
	Bun.file(new URL(`./public/${name}`, import.meta.url));

function clientId(
	request: Request,
	server: { requestIP(request: Request): { address: string } | null } | null,
): string {
	return server?.requestIP(request)?.address ?? "unknown";
}

function safeId(id: string): string {
	return encodeURIComponent(id);
}

export function createDashboard(config: DashboardConfig) {
	const sessions = new SessionManager(
		config.authPassword,
		config.sessionTtlMinutes * 60_000,
		config.secureCookies,
	);
	const api = new KeyzoriApi(config);
	const requireSession = ({
		request,
		set,
	}: {
		request: Request;
		set: { status?: number | string };
	}) => {
		if (!sessions.verify(request)) {
			set.status = 401;
			return { error: "Unauthorized" };
		}
		if (!isSameOriginMutation(request)) {
			set.status = 403;
			return { error: "Cross-origin request rejected" };
		}
	};

	return new Elysia({ name: "keyzori-dashboard" })
		.onError(({ code, set }) => {
			if (code === "VALIDATION" || code === "PARSE") {
				set.status = 400;
				return { error: "Invalid request" };
			}
			if (code === "NOT_FOUND") {
				set.status = 404;
				return { error: "Not found" };
			}
			set.status = 500;
			return { error: "Internal Server Error" };
		})
		.onAfterHandle(({ set }) => {
			set.headers["cache-control"] = "no-store";
			set.headers["content-security-policy"] =
				"default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; connect-src 'self'; object-src 'none'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'";
			set.headers["cross-origin-opener-policy"] = "same-origin";
			set.headers["cross-origin-resource-policy"] = "same-origin";
			set.headers["permissions-policy"] =
				"camera=(), geolocation=(), microphone=()";
			set.headers["referrer-policy"] = "no-referrer";
			set.headers["x-content-type-options"] = "nosniff";
			set.headers["x-frame-options"] = "DENY";
			if (config.secureCookies) {
				set.headers["strict-transport-security"] = "max-age=31536000";
			}
		})
		.get(
			"/",
			() =>
				new Response(publicAsset("index.html"), {
					headers: { "content-type": "text/html; charset=utf-8" },
				}),
		)
		.get(
			"/assets/styles.css",
			() =>
				new Response(publicAsset("styles.css"), {
					headers: { "content-type": "text/css; charset=utf-8" },
				}),
		)
		.get(
			"/assets/app.js",
			() =>
				new Response(publicAsset("app.js"), {
					headers: { "content-type": "text/javascript; charset=utf-8" },
				}),
		)
		.get("/healthz", () => ({ status: "ok" as const }))
		.get("/api/session", ({ request }) => {
			const authenticated = sessions.verify(request);
			return {
				authenticated,
				server: authenticated ? config.serverUrl.host : null,
			};
		})
		.post(
			"/api/login",
			({ body, request, set, server }) => {
				if (!isSameOriginMutation(request)) {
					set.status = 403;
					return { error: "Cross-origin request rejected" };
				}
				const result = sessions.login(body.password, clientId(request, server));
				if (!result.ok) {
					set.status = result.retryAfterSeconds ? 429 : 401;
					if (result.retryAfterSeconds) {
						set.headers["retry-after"] = String(result.retryAfterSeconds);
					}
					return { error: "Authentication failed" };
				}
				set.headers["set-cookie"] = result.cookie;
				return { authenticated: true as const };
			},
			{
				body: t.Object({
					password: t.String({ minLength: 1, maxLength: 1_024 }),
				}),
			},
		)
		.post("/api/logout", ({ request, set }) => {
			const rejected = requireSession({ request, set });
			if (rejected) return rejected;
			set.headers["set-cookie"] = sessions.logout(request);
			return { authenticated: false as const };
		})
		.group("/api/admin", (app) =>
			app
				.onBeforeHandle(requireSession)
				.get("/users", () => api.request("/admin/users", "GET"))
				.get("/users/:id", ({ params }) =>
					api.request(`/admin/users/${safeId(params.id)}`, "GET"),
				)
				.post("/users", ({ body }) => api.request("/admin/users", "POST", body))
				.patch("/users/:id", ({ params, body }) =>
					api.request(`/admin/users/${safeId(params.id)}`, "PATCH", body),
				)
				.delete("/users/:id", ({ params }) =>
					api.request(`/admin/users/${safeId(params.id)}`, "DELETE"),
				)
				.get("/keys", () => api.request("/admin/keys", "GET"))
				.get("/keys/:id", ({ params }) =>
					api.request(`/admin/keys/${safeId(params.id)}`, "GET"),
				)
				.post("/keys", ({ body }) => api.request("/admin/keys", "POST", body))
				.put("/keys/:id", ({ params, body }) =>
					api.request(`/admin/keys/${safeId(params.id)}`, "PUT", body),
				)
				.patch("/keys/:id/revoke", ({ params }) =>
					api.request(`/admin/keys/${safeId(params.id)}`, "PATCH"),
				)
				.delete("/keys/:id", ({ params }) =>
					api.request(`/admin/keys/${safeId(params.id)}`, "DELETE"),
				),
		);
}

async function main(): Promise<void> {
	const config = loadDashboardConfig();
	const app = createDashboard(config).listen({
		hostname: config.host,
		port: config.port,
		maxRequestBodySize: 65_536,
	});
	console.log(
		`Keyzori dashboard is running at ${app.server?.hostname}:${app.server?.port}`,
	);
}

if (import.meta.main) {
	main().catch((error: unknown) => {
		console.error(error instanceof Error ? error.message : String(error));
		process.exit(1);
	});
}
