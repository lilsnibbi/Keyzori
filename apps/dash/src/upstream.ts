import type { DashboardConfig } from "./config";

const MAX_UPSTREAM_RESPONSE_BYTES = 2 * 1024 * 1024;

export class KeyzoriApi {
	constructor(private readonly config: DashboardConfig) {}

	async request(
		path: string,
		method: "GET" | "POST" | "PATCH" | "PUT" | "DELETE",
		body?: unknown,
	): Promise<Response> {
		const url = new URL(path, this.config.serverUrl);
		try {
			const response = await fetch(url, {
				method,
				headers: {
					accept: "application/json",
					"content-type": "application/json",
					"x-admin-key": this.config.adminKey,
				},
				body: body === undefined ? undefined : JSON.stringify(body),
				redirect: "manual",
				signal: AbortSignal.timeout(this.config.upstreamTimeoutMs),
			});
			if (response.status >= 300 && response.status < 400) {
				throw new Error("Upstream redirects are not allowed.");
			}
			const declaredLength = Number(
				response.headers.get("content-length") ?? 0,
			);
			if (declaredLength > MAX_UPSTREAM_RESPONSE_BYTES) {
				throw new Error("Upstream response exceeded the size limit.");
			}
			const text = await response.text();
			if (Buffer.byteLength(text) > MAX_UPSTREAM_RESPONSE_BYTES) {
				throw new Error("Upstream response exceeded the size limit.");
			}
			let payload: unknown = null;
			if (text) {
				try {
					payload = JSON.parse(text);
				} catch {
					throw new Error("Upstream returned a non-JSON response.");
				}
			}
			return Response.json(payload, {
				status: response.status,
				headers: { "cache-control": "no-store" },
			});
		} catch (error) {
			console.error(
				JSON.stringify({
					level: "error",
					event: "keyzori_upstream_failed",
					method,
					path,
					message: error instanceof Error ? error.message : "Unknown error",
				}),
			);
			return Response.json(
				{ error: "The Keyzori server is unavailable." },
				{ status: 502 },
			);
		}
	}
}
